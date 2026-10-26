import { useState, useEffect, useCallback } from 'react';

export function useRepositories() {
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState(null);

  const loadRepositories = useCallback(async () => {
    if (!window.pullmateApi?.repositories) return;
    try {
      const list = await window.pullmateApi.repositories.getAll();
      setRepositories(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load repositories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRepositories();

    if (window.pullmateApi?.repositories?.onUpdated) {
      const unsubscribe = window.pullmateApi.repositories.onUpdated(() => {
        loadRepositories();
      });
      return () => unsubscribe();
    }
  }, [loadRepositories]);

  const checkAll = useCallback(async () => {
    if (!window.pullmateApi?.repositories || isCheckingAll) return;
    setIsCheckingAll(true);
    try {
      await window.pullmateApi.repositories.checkAll();
      await loadRepositories();
    } catch (err) {
      console.error('Error running check-all:', err);
    } finally {
      setIsCheckingAll(false);
    }
  }, [isCheckingAll, loadRepositories]);

  const checkStatus = useCallback(async (repoId) => {
    if (!window.pullmateApi?.repositories) return;
    setActionInProgressId(repoId);
    try {
      await window.pullmateApi.repositories.checkStatus(repoId);
      await loadRepositories();
    } catch (err) {
      console.error(`Failed to check repo ${repoId}:`, err);
    } finally {
      setActionInProgressId(null);
    }
  }, [loadRepositories]);

  const pullRepository = useCallback(async (repoId) => {
    if (!window.pullmateApi?.repositories) return;
    setActionInProgressId(repoId);
    try {
      const result = await window.pullmateApi.repositories.pull(repoId);
      await loadRepositories();
      return result;
    } catch (err) {
      console.error(`Failed to pull repo ${repoId}:`, err);
      throw err;
    } finally {
      setActionInProgressId(null);
    }
  }, [loadRepositories]);

  const removeRepository = useCallback(async (repoId) => {
    if (!window.pullmateApi?.repositories) return;
    try {
      const success = await window.pullmateApi.repositories.remove(repoId);
      await loadRepositories();
      return success;
    } catch (err) {
      console.error(`Failed to remove repo ${repoId}:`, err);
      throw err;
    }
  }, [loadRepositories]);

  const addRepository = useCallback(async (repoData) => {
    if (!window.pullmateApi?.repositories) return;
    try {
      const added = await window.pullmateApi.repositories.add(repoData);
      await loadRepositories();
      return added;
    } catch (err) {
      console.error('Failed to add repo:', err);
      throw err;
    }
  }, [loadRepositories]);

  const openFolder = useCallback(async (localPath) => {
    if (!window.pullmateApi?.repositories) return;
    return window.pullmateApi.repositories.openFolder(localPath);
  }, []);

  const openExternal = useCallback(async (url) => {
    if (!window.pullmateApi?.repositories) return;
    return window.pullmateApi.repositories.openExternal(url);
  }, []);

  return {
    repositories,
    loading,
    isCheckingAll,
    actionInProgressId,
    checkAll,
    checkStatus,
    pullRepository,
    removeRepository,
    addRepository,
    openFolder,
    openExternal,
    refreshRepositories: loadRepositories
  };
}
