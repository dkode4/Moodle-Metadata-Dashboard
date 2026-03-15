// provider that manages the active dataset, its computed metrics, and shared ui state -
// listens to firebase auth and firestore so metrics load automatically when a dataset is activated
import { useState, useEffect, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';
import { getAllTimeUserTotals, getAllUsersWithTiers } from '../utils/userUtils';
import { ActiveDatasetContext } from './useActiveDataset';

export function ActiveDatasetProvider({ children }) {
  const [activeDataset, setActiveDatasetLocal] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastComputed, setLastComputed] = useState(null);

  // connectionsUI holds the period granularity and selected period - shared between
  // the dashboard, connections, events, and users pages so navigation preserves the selection
  const [connectionsUI, setConnectionsUI] = useState({
    periodType: 'daily',
    selectedPeriod: null
  });

  // allTime and allUsersWithTiers are derived from metrics - recomputed only when metrics changes
  const allTime = useMemo(() => metrics ? getAllTimeUserTotals(metrics) : null, [metrics]);
  const allUsersWithTiers = useMemo(() => allTime ? getAllUsersWithTiers(allTime) : [], [allTime]);

  // outer listener watches firebase auth - when the user changes, the firestore
  // snapshot from the previous session is cancelled before a new one is attached
  useEffect(() => {
    let unsubSnapshot = null;

    const unsubAuth = onAuthStateChanged(getAuth(app), (user) => {
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (!user) {
        // clear all state on sign-out so a subsequent login starts fresh
        setActiveDatasetLocal(null);
        setMetrics(null);
        setLastComputed(null);
        setLoading(false);
        setConnectionsUI({ periodType: 'daily', selectedPeriod: null });
        return;
      }

      const db = getFirestore(app);

      // listen to the user's firestore doc - fires immediately on attach and again
      // whenever activeDataset changes (e.g. user selects a different file)
      unsubSnapshot = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
        const data = snap.data();
        const newActiveDataset = data?.activeDataset;

        setActiveDatasetLocal(newActiveDataset);
        setLoading(false);

        if (newActiveDataset && newActiveDataset.filename !== lastComputed) {
          try {
            // call the cloud function to compute metrics for the newly activated dataset
            const functions = getFunctions(app);
            const computeMetrics = httpsCallable(functions, 'computeDatasetMetrics');
            const result = await computeMetrics({
              datasetId: newActiveDataset.filename,
              userId: user.uid
            });
            setMetrics(result.data.metrics);
            setLastComputed(newActiveDataset.filename);
            // reset period selection so pages default to the first period in the new dataset
            setConnectionsUI({ periodType: 'daily', selectedPeriod: null });
          } catch (e) {
            console.log('Auto-compute failed:', e.message);
          }
        } else if (!newActiveDataset) {
          setMetrics(null);
          setLastComputed(null);
          setConnectionsUI({ periodType: 'daily', selectedPeriod: null });
        }
      });
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  // setActive writes the selected file to firestore - the onSnapshot listener above
  // picks up the change and triggers metric computation automatically.
  // passing null clears the active dataset
  const setActive = async (fileObj) => {
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return;

    const db = getFirestore(app);
    const userDocRef = doc(db, 'users', user.uid);

    if (fileObj) {
      // merge:true so other fields on the user doc aren't overwritten
      await setDoc(userDocRef, {
        activeDataset: {
          filename: fileObj.filename,
          token: fileObj.token,
          path: `userFiles/${fileObj.userId}/${fileObj.filename}/${fileObj.filename}`
        }
      }, { merge: true });
    } else {
      await updateDoc(userDocRef, { activeDataset: null });
    }
  };

  return (
    <ActiveDatasetContext.Provider value={{
      activeDataset,
      metrics,
      loading,
      setActive,
      connectionsUI,
      setConnectionsUI,
      allTime,
      allUsersWithTiers
    }}>
      {children}
    </ActiveDatasetContext.Provider>
  );
}