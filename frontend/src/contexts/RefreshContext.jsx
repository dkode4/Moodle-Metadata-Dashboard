// simple boolean toggle context used to signal the data page to re-fetch its
// file list after an upload completes - the sidebar calls triggerRefresh and
// the data page re-runs its useEffect whenever refreshFlag changes
import { createContext, useContext, useState } from "react";

const RefreshContext = createContext();

export function useRefresh() {
  return useContext(RefreshContext);
}

export function RefreshProvider({ children }) {
  const [refreshFlag, setRefreshFlag] = useState(false);
  const triggerRefresh = () => setRefreshFlag(flag => !flag);

  return (
    <RefreshContext.Provider value={{ refreshFlag, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}
