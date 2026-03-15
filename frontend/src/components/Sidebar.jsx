// main navigation sidebar - handles csv uploads, groups nav links by category,
// shows a notification badge when alerts are present, and provides sign-out
import React from 'react';
import { getAuth, signOut } from "firebase/auth";
import { app } from "../firebase";
import { NavLink } from "react-router-dom";
import {
  FiUser, FiBarChart2, FiActivity,
  FiUsers, FiDatabase, FiX, FiGlobe, FiBell
} from "react-icons/fi";
import { MdOutlineSchool } from 'react-icons/md';
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL, updateMetadata
} from "firebase/storage";
import {
  getFirestore, doc, getDoc, updateDoc, arrayUnion
} from "firebase/firestore";
import logo from '/src/assets/logo.png';
import { useState, useEffect, useCallback } from "react";
import UploadStatus from "../components/UploadStatus";
import { useRefresh } from "../contexts/RefreshContext";
import { useActiveDataset } from '../contexts/useActiveDataset';
import { severityOf } from '../utils/notificationUtils';

export default function Sidebar({ onClose }) {
  const { triggerRefresh } = useRefresh();
  const { metrics } = useActiveDataset();
  // show the red dot on the notifications link if the active dataset has any warnings or errors
  const hasAlerts = metrics ? severityOf(metrics.dataAlerts) === 'error' || severityOf(metrics.dataAlerts) === 'warning' : false;
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadFilename, setUploadFilename] = useState("");

  // auto-dismiss the upload modal 2.5 seconds after a successful upload
  useEffect(() => {
    if (!uploadDone) return;
    const t = setTimeout(closeStatus, 2500);
    return () => clearTimeout(t);
  }, [uploadDone]);

  const handleSignOut = useCallback(() => signOut(getAuth(app)), []);

  const closeStatus = useCallback(() => {
    setUploading(false);
    setUploadDone(false);
    setUploadError("");
    setUploadProgress(0);
    setUploadFilename("");
  }, []);

  const navLinkClasses = ({ isActive }) =>
    `flex items-center gap-3 py-3 px-3 rounded-lg text-base tracking-wide font-normal transition-colors
     hover:text-blue-600 hover:bg-blue-50
     ${isActive ? "bg-blue-50 text-blue-600 border border-blue-200" : "text-gray-700 border border-transparent"}`;

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "text/csv") return alert("CSV files only!");

    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return alert("Login required!");

    const uid = user.uid;
    const filename = file.name;

    // check for a duplicate filename before starting the upload -
    // firebase storage would overwrite silently so we catch it here first
    try {
      const db = getFirestore(app);
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const existing = snap.data().userFiles || [];
        if (existing.some(f => f.filename === filename)) {
          alert(`"${filename}" already exists! Delete it first or rename your file.`);
          e.target.value = '';
          return;
        }
      }
    } catch (err) {
      console.error("Check failed:", err);
      alert("Error checking files. Try again.");
      e.target.value = '';
      return;
    }

    setUploading(true);
    setUploadFilename(filename);
    setUploadProgress(0);
    setUploadDone(false);
    setUploadError("");

    const storage = getStorage(app);
    // the file is stored inside its own folder so metrics.json can sit alongside it
    const storageRef = ref(storage, `userFiles/${uid}/${filename}/${filename}`);
    const metadata = { contentType: "text/csv", customMetadata: { uploadedBy: uid } };
    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    uploadTask.on('state_changed',
      (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      (err) => { setUploadError(err.message); setUploading(false); },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          // the download token is extracted from the url and stored so the file can be
          // re-downloaded later without generating a new signed url each time
          const token = new URL(downloadURL).searchParams.get("token");
          await updateMetadata(storageRef, metadata);
          // arrayUnion adds the file entry without overwriting other files in the list
          await updateDoc(doc(getFirestore(app), "users", uid), {
            userFiles: arrayUnion({ token, filename, created: new Date().toISOString(), downloadURL, size: file.size, type: file.type, userId: uid })
          });
          setUploadDone(true);
          setUploading(false);
          // signal the data page to re-fetch the file list
          triggerRefresh();
        } catch (err) {
          setUploadError(err.message);
          setUploading(false);
        }
      }
    );
    // reset the input so the same file can be re-selected if needed
    e.target.value = '';
  };

  return (
    <>
      <UploadStatus
        open={uploading || uploadDone || !!uploadError}
        filename={uploadFilename}
        progress={uploadProgress}
        done={uploadDone}
        error={uploadError}
        onClose={closeStatus}
      />

      <aside className="fixed top-0 left-0 z-50 w-72 h-screen bg-white flex flex-col shadow-xl border-r border-gray-200">
        <div className="flex flex-col flex-1 px-5 py-6 overflow-y-auto min-h-0">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="w-9 h-9 rounded-full shadow shrink-0" />
              <span className="text-2xl font-normal">Moodlytics</span>
            </div>
            <button
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              onClick={onClose}
              aria-label="Close sidebar"
              type="button"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
          <div className="mb-6">
            <label htmlFor="sidebar-file-upload" className="block text-sm font-medium tracking-wider text-gray-500 mb-2">
              Upload File
            </label>
            <input
              id="sidebar-file-upload"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer tracking-wide"
              aria-label="Upload a CSV file"
            />
          </div>
          <div className="mb-2 text-sm font-medium tracking-wider text-gray-500">Menu</div>
          <nav className="flex flex-col gap-0.5 mb-5">
            <NavLink to="/notifications" className={navLinkClasses}>
              <span className="relative">
                <FiBell className="w-5 h-5 shrink-0" />
                {hasAlerts && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
                )}
              </span>
              Notifications
            </NavLink>
            <NavLink to="/dashboard" className={navLinkClasses}>
              <MdOutlineSchool className="w-5 h-5 shrink-0" /> Course Overview
            </NavLink>
          </nav>

          <div className="mb-2 text-sm font-medium tracking-wider text-gray-500">Data & Analytics</div>
          <nav className="flex flex-col gap-0.5 mb-5">
            <NavLink to="/events" className={navLinkClasses}>
              <FiActivity className="w-5 h-5 shrink-0" /> Event Activity
            </NavLink>
            <NavLink to="/users" end className={navLinkClasses}>
              <FiBarChart2 className="w-5 h-5 shrink-0" /> User Analytics
            </NavLink>
            <NavLink to="/users/all" className={navLinkClasses}>
              <FiUsers className="w-5 h-5 shrink-0" /> All Users
            </NavLink>
            <NavLink to="/connections" className={navLinkClasses}>
              <FiGlobe className="w-5 h-5 shrink-0" /> Connections
            </NavLink>
          </nav>

          <div className="mb-2 text-sm font-medium tracking-wider text-gray-500">Preferences</div>
          <nav className="flex flex-col gap-0.5">
            <NavLink to="/profile" className={navLinkClasses}>
              <FiUser className="w-5 h-5 shrink-0" /> Account
            </NavLink>
            <NavLink to="/data" className={navLinkClasses}>
              <FiDatabase className="w-5 h-5 shrink-0" /> Your Data
            </NavLink>
          </nav>
        </div>
        <div className="px-5 py-5 border-t border-gray-100">
          <button
            onClick={handleSignOut}
            type="button"
            className="text-gray-600 border border-gray-400 hover:bg-gray-100 hover:text-gray-800 w-full py-2 rounded-lg text-base font-normal transition-colors duration-300 shadow-sm hover:shadow-md"
          >
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}