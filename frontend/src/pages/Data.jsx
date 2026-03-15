// file management page - lists the user's uploaded csv datasets with options
// to activate, sort, download, and permanently delete them from firebase storage
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import { getStorage, ref, getDownloadURL, deleteObject } from "firebase/storage";
import { useEffect, useState } from "react";
import { app } from "../firebase";
import { useRefresh } from "../contexts/RefreshContext";
import { useActiveDataset } from '../contexts/useActiveDataset';

const sortOptions = [
  { label: "Newest", value: "date-desc" },
  { label: "Oldest", value: "date-asc" },
  { label: "Smallest Size", value: "size-asc" },
  { label: "Largest Size", value: "size-desc" },
];

export default function DataPage() {
  const { refreshFlag } = useRefresh();
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("date-desc");
  const { activeDataset, setActive } = useActiveDataset();

  // re-runs whenever refreshFlag changes, which is triggered after a new upload completes
  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      const auth = getAuth(app);
      const user = auth.currentUser;
      if (!user) return setLoading(false);

      const db = getFirestore(app);
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      let filteredFiles = [];

      if (userDocSnap.exists()) {
        const rawFiles = userDocSnap.data().userFiles || [];
        // verify each file still exists in storage before showing it -
        // entries whose storage objects have been deleted are silently excluded
        await Promise.all(rawFiles.map(async (fileObj) => {
          const storage = getStorage(app);
          const filePath = `userFiles/${fileObj.userId}/${fileObj.filename}/${fileObj.filename}`;
          const fileRef = ref(storage, filePath);
          try {
            await getDownloadURL(fileRef);
            filteredFiles.push(fileObj);
          } catch (e) {
            // only suppress object-not-found errors - anything else is unexpected
            if (e.code !== "storage/object-not-found") console.error(e);
          }
        }));
      }
      setFileList(filteredFiles);
      setLoading(false);
    };
    fetchFiles();
  }, [refreshFlag]);

  // sort is applied to a copy of fileList so the original order is preserved
  const sortedFiles = [...fileList].sort((a, b) => {
    if (sortBy === "date-desc") return new Date(b.created) - new Date(a.created);
    if (sortBy === "date-asc")  return new Date(a.created) - new Date(b.created);
    if (sortBy === "size-asc")  return a.size - b.size;
    if (sortBy === "size-desc") return b.size - a.size;
    return 0;
  });

  const handleDelete = async (fileObj) => {
    if (!window.confirm(`Delete ${fileObj.filename} permanently?`)) return;

    // if the file being deleted is currently active, clear the active dataset first
    if (activeDataset?.token === fileObj.token) {
      setActive(null);
    }

    try {
      const storage = getStorage(app);
      const csvPath     = `userFiles/${fileObj.userId}/${fileObj.filename}/${fileObj.filename}`;
      const metricsPath = `userFiles/${fileObj.userId}/${fileObj.filename}/metrics.json`;

      // delete the csv and its metrics file in parallel -
      // metrics.json may not exist if processing never completed, so that error is swallowed
      await Promise.all([
        deleteObject(ref(storage, csvPath)),
        deleteObject(ref(storage, metricsPath)).catch(e => {
          if (e.code !== "storage/object-not-found") throw e;
        })
      ]);

      // remove the file entry from the userFiles array in firestore
      const db = getFirestore(app);
      const auth = getAuth(app);
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userDocRef, {
        userFiles: arrayRemove(fileObj)
      });

      // update local state so the row disappears without needing a full re-fetch
      setFileList(prev => prev.filter(f => f.token !== fileObj.token));

      alert("File deleted successfully.");
    } catch (e) {
      alert("Error deleting file: " + e.message);
    }
  };

  return (
    <section className="p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-normal">Your Uploaded Data</h2>
        <div className="flex items-center gap-4">
          <select
            className="border border-gray-300 rounded px-3 py-1 text-sm"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            {sortOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p>Loading files...</p>
      ) : sortedFiles.length === 0 ? (
        <p>No files uploaded yet.</p>
      ) : (
        <div className="rounded-lg shadow border border-gray-200 bg-white overflow-auto">
          <table className="min-w-full divide-y divide-gray-100 w-full">
            {/* header is sticky so it stays visible when scrolling a long file list */}
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="py-2 px-4 text-left font-semibold">Active</th>
                <th className="py-2 px-4 text-left font-semibold">Filename</th>
                {/* secondary columns are hidden on smaller screens */}
                <th className="py-2 px-4 text-left font-semibold max-lg:hidden">Type</th>
                <th className="py-2 px-4 text-left font-semibold max-lg:hidden">Size (bytes)</th>
                <th className="py-2 px-4 text-left font-semibold max-lg:hidden">Uploaded At</th>
                <th className="py-2 px-4 text-left font-semibold max-lg:hidden">Download</th>
                <th className="py-2 px-4 text-left font-semibold max-lg:hidden">Delete</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((file) => (
                <tr key={file.token} className="hover:bg-blue-50">
                  {/* checkbox activates this file as the current dataset for analytics */}
                  <td className="py-2 px-4">
                    <input
                      type="checkbox"
                      checked={activeDataset?.token === file.token}
                      onChange={() => setActive(file)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded"
                    />
                  </td>
                  <td className="py-2 px-4">{file.filename}</td>
                  <td className="py-2 px-4 max-lg:hidden">{file.type}</td>
                  <td className="py-2 px-4 max-lg:hidden">{file.size}</td>
                  <td className="py-2 px-4 max-lg:hidden">{new Date(file.created).toLocaleString()}</td>
                  <td className="py-2 px-4 max-lg:hidden">
                    <a href={file.downloadURL} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      Download
                    </a>
                  </td>
                  <td className="py-2 px-4 max-lg:hidden">
                    <button
                      onClick={() => handleDelete(file)}
                      className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
