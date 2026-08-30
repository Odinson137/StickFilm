import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SceneList } from './components/SceneList';
import { SceneDetail } from './components/SceneDetail';
import { MasterPromptModal } from './components/MasterPromptModal';
import { ScriptImporterModal } from './components/ScriptImporterModal';
import { TokenSettingsModal } from './components/TokenSettingsModal';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { VideoStudioModal } from './components/VideoStudioModal';
import { ThumbnailModal } from './components/ThumbnailModal';
import { ShortsGeneratorModal } from './components/ShortsGeneratorModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { api } from './services/api';
import { Project, Scene } from './types';

export const App: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isBatchAudioLoading, setIsBatchAudioLoading] = useState<boolean>(false);
  const [isBatchImagesLoading, setIsBatchImagesLoading] = useState<boolean>(false);

  // Modal States
  const [isMasterPromptOpen, setIsMasterPromptOpen] = useState<boolean>(false);
  const [isImporterOpen, setIsImporterOpen] = useState<boolean>(false);
  const [isTokensOpen, setIsTokensOpen] = useState<boolean>(false);
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState<boolean>(false);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState<boolean>(false);
  const [isShortsGeneratorOpen, setIsShortsGeneratorOpen] = useState<boolean>(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState<boolean>(false);

  // Initial Load - Always open latest created/updated project or remembered project
  useEffect(() => {
    api.listProjects().then((list) => {
      if (list.length > 0) {
        const savedId = localStorage.getItem('last_project_id');
        const found = savedId ? list.find((p) => p.id === savedId) : null;
        const targetId = found ? found.id : list[0].id;
        loadProject(targetId);
      } else {
        api.createProject('Одиссея (2026)').then((p) => {
          setProject(p);
          localStorage.setItem('last_project_id', p.id);
        });
      }
    });
  }, []);

  const loadProject = async (id: string) => {
    try {
      const proj = await api.getProject(id);
      setProject(proj);
      localStorage.setItem('last_project_id', proj.id);
      if (proj.scenes && proj.scenes.length > 0) {
        setActiveSceneId(proj.scenes[0].id);
      } else {
        setActiveSceneId(null);
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  };

  const handleSave = async () => {
    if (!project) return;
    setIsSaving(true);
    try {
      const saved = await api.saveProject(project);
      setProject(saved);
      setTimeout(() => setIsSaving(false), 1200);
    } catch (err) {
      console.error('Failed to save project:', err);
      setIsSaving(false);
    }
  };

  const handleUpdateScene = (updated: Scene) => {
    if (!project) return;
    const newScenes = project.scenes.map((s) => (s.id === updated.id ? updated : s));
    setProject({ ...project, scenes: newScenes });
  };

  const handleImportScenes = async (data: {scenes: Scene[], settings?: any, thumbnails?: any[]}) => {
    if (!project) return;
    const { scenes: newScenes, settings, thumbnails } = data;
    const updatedProj: Project = { ...project, scenes: newScenes };
    
    if (settings) {
      updatedProj.settings = { ...updatedProj.settings };
      if (settings.movie_passport) {
        updatedProj.settings.movie_passport = { ...updatedProj.settings.movie_passport, ...settings.movie_passport };
      }
      if (settings.bgm) {
        updatedProj.settings.bgm = { ...updatedProj.settings.bgm, ...settings.bgm };
      }
      if (settings.subtitles) {
        updatedProj.settings.subtitles = { ...updatedProj.settings.subtitles, ...settings.subtitles };
      }
    }
    
    setProject(updatedProj);
    if (newScenes.length > 0) {
      setActiveSceneId(newScenes[0].id);
    }
    await api.saveProject(updatedProj);
    
    if (thumbnails && thumbnails.length > 0) {
      await api.saveThumbnails(updatedProj.id, thumbnails);
    }
  };

  // Scene navigation
  const scenes = project?.scenes || [];
  const currentSceneIndex = scenes.findIndex((s) => s.id === activeSceneId);
  const activeScene = currentSceneIndex !== -1 ? scenes[currentSceneIndex] : null;

  const handlePrevScene = () => {
    if (currentSceneIndex > 0) {
      setActiveSceneId(scenes[currentSceneIndex - 1].id);
    }
  };

  const handleNextScene = () => {
    if (currentSceneIndex < scenes.length - 1) {
      setActiveSceneId(scenes[currentSceneIndex + 1].id);
    }
  };

  // Batch Generation Handlers
  const handleBatchAudio = async () => {
    if (!project) return;
    setIsBatchAudioLoading(true);
    try {
      await api.generateAllAudio(project.id);
      await loadProject(project.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBatchAudioLoading(false);
    }
  };

  const [batchProgress, setBatchProgress] = useState<{ isRunning: boolean; current: number; total: number; label: string }>({
    isRunning: false,
    current: 0,
    total: 0,
    label: ''
  });

  const handleBatchImages = async () => {
    if (!project) return;
    setIsBatchImagesLoading(true);
    try {
      await api.generateAllImages(project.id);
      
      const interval = setInterval(async () => {
        try {
          const status = await api.getBatchImagesStatus(project.id);
          setBatchProgress({
            isRunning: status.is_running,
            current: status.current,
            total: status.total,
            label: status.label
          });
          if (status.current > 0) {
            loadProject(project.id);
          }
          if (!status.is_running) {
            clearInterval(interval);
            setIsBatchImagesLoading(false);
            loadProject(project.id);
          }
        } catch (e) {
          console.error(e);
        }
      }, 2500);
    } catch (err) {
      console.error(err);
      setIsBatchImagesLoading(false);
    }
  };

  const handleStopBatchImages = async () => {
    if (!project) return;
    try {
      await api.stopBatchImages(project.id);
      setIsBatchImagesLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAspectRatio = async (aspectRatio: '16:9' | '9:16') => {
    if (!project) return;
    const updatedSettings = { ...project.settings, aspect_ratio: aspectRatio };
    const updatedProj: Project = { ...project, settings: updatedSettings };
    setProject(updatedProj);
    await api.saveProject(updatedProj);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-dark-900 text-slate-100 overflow-hidden">
      {/* Top Navigation Bar */}
      <Header
        project={project}
        onSave={handleSave}
        isSaving={isSaving}
        onToggleAspectRatio={handleToggleAspectRatio}
        onOpenMasterPrompt={() => setIsMasterPromptOpen(true)}
        onOpenImporter={() => setIsImporterOpen(true)}
        onOpenTokens={() => setIsTokensOpen(true)}
        onOpenStudio={() => setIsStudioOpen(true)}
        onOpenThumbnails={() => setIsThumbnailsOpen(true)}
        onOpenProjectManager={() => setIsProjectManagerOpen(true)}
        onOpenShortsGenerator={() => setIsShortsGeneratorOpen(true)}
        onOpenProjectSettings={() => setIsProjectSettingsOpen(true)}
      />

      {/* Main Studio Body: Sidebar + Inspector */}
      <div className="flex flex-1 h-[calc(100vh-4rem)] overflow-hidden">
        <SceneList
          scenes={scenes}
          activeSceneId={activeSceneId}
          onSelectScene={(id) => setActiveSceneId(id)}
        />

        <SceneDetail
          scene={activeScene}
          projectId={project?.id || ''}
          aspectRatio={project?.settings?.aspect_ratio || '16:9'}
          onUpdateScene={handleUpdateScene}
          onPrevScene={handlePrevScene}
          onNextScene={handleNextScene}
          hasPrev={currentSceneIndex > 0}
          hasNext={currentSceneIndex < scenes.length - 1}
          onBatchAudio={handleBatchAudio}
          onBatchImages={handleBatchImages}
          onStopBatchImages={handleStopBatchImages}
          isBatchAudioLoading={isBatchAudioLoading}
          isBatchImagesLoading={isBatchImagesLoading}
          batchProgress={batchProgress}
        />
      </div>

      {/* Modals */}
      <MasterPromptModal
        isOpen={isMasterPromptOpen}
        onClose={() => setIsMasterPromptOpen(false)}
        currentAspectRatio={project?.settings?.aspect_ratio || '16:9'}
      />

      <ScriptImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImport={handleImportScenes}
      />

      <TokenSettingsModal
        isOpen={isTokensOpen}
        onClose={() => setIsTokensOpen(false)}
      />

      {project && (
        <ThumbnailModal
          isOpen={isThumbnailsOpen}
          onClose={() => setIsThumbnailsOpen(false)}
          projectId={project.id}
          aspectRatio={project.settings?.aspect_ratio || '16:9'}
        />
      )}
      
      {project && (
        <ShortsGeneratorModal
          isOpen={isShortsGeneratorOpen}
          onClose={() => setIsShortsGeneratorOpen(false)}
          project={project}
        />
      )}

      <ProjectManagerModal
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
        currentProjectId={project?.id || ''}
        onSelectProject={(id) => loadProject(id)}
        onProjectCreated={(id) => loadProject(id)}
      />

      {project && (
        <VideoStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          projectId={project.id}
        />
      )}

      {project && (
        <ProjectSettingsModal
          isOpen={isProjectSettingsOpen}
          onClose={() => setIsProjectSettingsOpen(false)}
          project={project}
          onUpdateProject={(updated) => setProject(updated)}
        />
      )}
    </div>
  );
};

export default App;
