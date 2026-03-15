// profile page - lets the user update their avatar and banner via url input
// and displays their account details from firestore
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { app } from "../firebase";

export default function Profile() {
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  // separate error flags for avatar and banner so a broken url on one doesn't affect the other
  const [avatarError, setAvatarError] = useState(false);
  const [bannerError, setBannerError] = useState(false);
  const navigate = useNavigate();

  const auth = getAuth(app);
  const user = auth.currentUser;
  const uid = user?.uid;

  // redirect to login if there is no authenticated user
  useEffect(() => {
    if (!uid) {
      navigate("/login", { replace: true });
    }
  }, [uid, navigate]);

  // fetch the user's firestore document once the uid is available
  useEffect(() => {
    if (!uid) return;
    const db = getFirestore(app);
    getDoc(doc(db, "users", uid)).then((snapshot) => {
      if (snapshot.exists()) {
        setUserDoc(snapshot.data());
        // reset error flags in case the document was updated since the last load
        setAvatarError(false);
        setBannerError(false);
      }
      setLoading(false);
    });
  }, [uid]);

  // prompts the user for an image url, validates the extension, then saves it to firestore
  // and updates local state so the new image appears without a page reload
  const handleAvatarUrl = async () => {
    const url = window.prompt("Enter URL for your avatar image:");
    if (!url || !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.trim())) {
      alert("Please enter a valid full image URL (jpg, png, gif, webp, svg).");
      return;
    }
    const db = getFirestore(app);
    await updateDoc(doc(db, "users", uid), { avatar: url.trim() });
    setAvatarError(false);
    setUserDoc({ ...userDoc, avatar: url.trim() });
  };

  const handleBannerUrl = async () => {
    const url = window.prompt("Enter URL for your banner image:");
    if (!url || !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.trim())) {
      alert("Please enter a valid full image URL (jpg, png, gif, webp, svg).");
      return;
    }
    const db = getFirestore(app);
    await updateDoc(doc(db, "users", uid), { banner: url.trim() });
    setBannerError(false);
    setUserDoc({ ...userDoc, banner: url.trim() });
  };

  if (loading) return <div className="p-8">Loading profile...</div>;
  if (!userDoc) return <div className="p-8">Couldn't load user info</div>;

  return (
    <div className="w-full">
      {/* banner area - falls back to a placeholder if no url is set or the image fails to load */}
      <div className="relative w-full h-48 md:h-56 bg-gray-300 rounded-lg overflow-hidden">
        {userDoc.banner && !bannerError ? (
          <img
            src={userDoc.banner}
            alt="Banner"
            className="w-full h-full object-cover rounded-lg"
            onError={() => setBannerError(true)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500 text-lg h-full">No Banner</div>
        )}
        <button
          onClick={handleBannerUrl}
          className="
            absolute right-6 bottom-6 z-10
            bg-white bg-opacity-80
            text-xs font-semibold px-4 py-2 rounded shadow
            transition
            hover:bg-gray-100 hover:bg-opacity-100
            hover:scale-105
            hover:shadow-lg
            focus:outline-none
          "
        >
          Change Banner
        </button>

        {/* avatar sits on top of the banner - clicking it triggers the url prompt */}
        <button
          onClick={handleAvatarUrl}
          className="absolute left-8 top-1/2 -translate-y-1/2 z-20 cursor-pointer group rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow w-24 h-24 md:w-32 md:h-32 flex items-center justify-center p-0"
          style={{ border: '4px solid white' }}
        >
          {userDoc.avatar && !avatarError ? (
            <img
              src={userDoc.avatar}
              alt="Avatar"
              className="w-full h-full rounded-full object-cover transition group-hover:brightness-75"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-gray-500 font-semibold text-lg">
              No Avatar
            </span>
          )}
          {/* edit icon overlay shown on hover */}
          <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black bg-opacity-20 rounded-full pointer-events-none">
            <span className="text-white text-lg">✏️</span>
          </span>
        </button>
      </div>

      {/* account details card */}
      <div className="mt-8 max-w-md mx-auto bg-white rounded-lg shadow p-8 border-gray-200 shadow text-center">
        <h2 className="text-xl font-semibold mb-4">Account Details</h2>
        <div className="mb-4 text-left">
          <span className="font-medium mr-2">Username:</span> {userDoc.username}
        </div>
        <div className="mb-4 text-left">
          <span className="font-medium mr-2">Email:</span> {userDoc.email}
        </div>
        <div className="mb-4 text-left">
          <span className="font-medium mr-2">Created At:</span> {userDoc.createdAt ? new Date(userDoc.createdAt).toLocaleString() : "N/A"}
        </div>
      </div>
    </div>
  );
}
