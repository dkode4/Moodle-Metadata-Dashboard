// context definition and hook for the active dataset - the actual provider and
// state logic live in ActiveDatasetContext.jsx, this file just exports the context
// object and the hook so components don't need to import both separately
import { createContext, useContext } from 'react';

export const ActiveDatasetContext = createContext();

export function useActiveDataset() {
  const context = useContext(ActiveDatasetContext);
  // throwing here catches components that forget to wrap in the provider,
  // which would otherwise silently return undefined and cause confusing errors
  if (!context) throw new Error('useActiveDataset must be used within ActiveDatasetProvider');
  return context;
}