import axios from 'axios';
import { Project, ProjectSettings, ProjectListItem, Scene, SceneImage, ImageVariant, TokenItem, RenderResult, ShortsAndTikToksResult, ProjectThumbnails, ThumbnailOption, WordTimestamp, PublishingMetadata } from '../types';

const API_BASE = 'http://localhost:8000';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Media URL helper
  getMediaUrl: (project_id: string, relPath: string | null | undefined, version?: number | string) => {
    if (!relPath) return '';
    return `${API_BASE}/media/projects/${project_id}/${relPath}${version ? `?v=${version}` : ''}`;
  },

  // Projects
  listProjects: async (): Promise<ProjectListItem[]> => {
    const res = await client.get<ProjectListItem[]>('/api/projects');
    return res.data;
  },

  getProject: async (id: string): Promise<Project> => {
    const res = await client.get<Project>(`/api/projects/${id}`);
    return res.data;
  },

  createProject: async (title: string, aspect_ratio: '16:9' | '9:16' = '16:9'): Promise<Project> => {
    const res = await client.post<Project>('/api/projects', { title, aspect_ratio });
    return res.data;
  },

  saveProject: async (project: Project): Promise<Project> => {
    const res = await client.put<Project>(`/api/projects/${project.id}`, project);
    return res.data;
  },

  updateProjectSettings: async (projectId: string, settings: Partial<ProjectSettings>): Promise<Project> => {
    const res = await client.put<Project>(`/api/projects/${projectId}/settings`, settings);
    return res.data;
  },

  updateImageStyle: async (projectId: string, sceneId: number, imageId: string, style: string, prompt?: string): Promise<any> => {
    const res = await client.put(`/api/images/${projectId}/scene/${sceneId}/image/${imageId}/style`, { style, prompt });
    return res.data;
  },

  // BGM / Music
  getBGMTracks: async (): Promise<any[]> => {
    const res = await client.get<any[]>('/api/bgm/tracks');
    return res.data;
  },

  downloadBGMFromYouTube: async (url: string, title?: string): Promise<any> => {
    const res = await client.post('/api/bgm/download-youtube', { url, title });
    return res.data;
  },

  uploadBGMTrack: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await client.post('/api/bgm/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getBGMStreamUrl: (filename: string): string => {
    return `${API_BASE}/api/bgm/stream/${encodeURIComponent(filename)}`;
  },

  deleteProject: async (id: string): Promise<{ success: boolean }> => {
    const res = await client.delete(`/api/projects/${id}`);
    return res.data;
  },

  // Script
  getMasterPrompt: async (aspect_ratio: '16:9' | '9:16' = '16:9'): Promise<{ prompt: string }> => {
    const res = await client.get<{ prompt: string }>(`/api/script/master-prompt?aspect_ratio=${aspect_ratio}`);
    return res.data;
  },

  parseScript: async (script_text: string): Promise<{scenes: Scene[], settings?: any, thumbnails?: any[]}> => {
    const res = await client.post<{scenes: Scene[], settings?: any, thumbnails?: any[]}>('/api/script/parse', { script_text });
    return res.data;
  },

  // Audio / ElevenLabs
  getTokens: async (): Promise<TokenItem[]> => {
    const res = await client.get<TokenItem[]>('/api/audio/tokens');
    return res.data;
  },

  addToken: async (key: string): Promise<TokenItem> => {
    const res = await client.post<TokenItem>('/api/audio/tokens', { key });
    return res.data;
  },

  deleteToken: async (key: string): Promise<{ success: boolean }> => {
    const res = await client.delete(`/api/audio/tokens/${key}`);
    return res.data;
  },

  checkToken: async (key: string): Promise<any> => {
    const res = await client.post(`/api/audio/tokens/${key}/check`);
    return res.data;
  },

  generateSingleAudio: async (projectId: string, sceneId: number, text?: string): Promise<any> => {
    const res = await client.post(`/api/audio/generate-single/${projectId}`, { scene_id: sceneId, text });
    return res.data;
  },

  generateAllAudio: async (projectId: string): Promise<any> => {
    const res = await client.post(`/api/audio/generate-all/${projectId}`);
    return res.data;
  },

  // Images / Word Alignment & Multi-Images
  getSceneWords: async (projectId: string, sceneId: number): Promise<{ words: WordTimestamp[] }> => {
    const res = await client.get<{ words: WordTimestamp[] }>(`/api/images/${projectId}/scene/${sceneId}/words`);
    return res.data;
  },

  addSceneImage: async (
    projectId: string,
    sceneId: number,
    data: { word_index: number; selected_text: string; start_time: number; prompt: string }
  ): Promise<SceneImage> => {
    const res = await client.post<SceneImage>(`/api/images/${projectId}/scene/${sceneId}/add-image`, {
      scene_id: sceneId,
      ...data,
    });
    return res.data;
  },

  deleteSceneImage: async (projectId: string, sceneId: number, imageId: string): Promise<{ success: boolean }> => {
    const res = await client.delete(`/api/images/${projectId}/scene/${sceneId}/delete-image/${imageId}`);
    return res.data;
  },

  generateSingleImage: async (projectId: string, sceneId: number, prompt?: string, imageId?: string, aspect_ratio?: '16:9' | '9:16'): Promise<any> => {
    const res = await client.post(`/api/images/generate-single/${projectId}`, { scene_id: sceneId, prompt, image_id: imageId, aspect_ratio });
    return res.data;
  },

  uploadVideoClip: async (
    projectId: string,
    sceneId: number,
    file: File,
    imageId?: string
  ): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (imageId) {
      formData.append('image_id', imageId);
    }
    const res = await client.post(`/api/images/${projectId}/scene/${sceneId}/upload-video`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getImageVariants: async (projectId: string, sceneId: number, imageId: string): Promise<{ scene_id: number; image_id: string; active_file: string; variants: ImageVariant[] }> => {
    const res = await client.get(`/api/images/${projectId}/scene/${sceneId}/variants/${imageId}`);
    return res.data;
  },

  selectImageVariant: async (projectId: string, sceneId: number, imageId: string, file: string): Promise<any> => {
    const res = await client.post(`/api/images/${projectId}/scene/${sceneId}/select-variant`, {
      image_id: imageId,
      file: file,
    });
    return res.data;
  },

  deleteImageVariant: async (projectId: string, sceneId: number, imageId: string, file: string): Promise<any> => {
    const res = await client.post(`/api/images/${projectId}/scene/${sceneId}/delete-variant`, {
      image_id: imageId,
      file: file,
    });
    return res.data;
  },

  generateAllImages: async (projectId: string): Promise<any> => {
    const res = await client.post(`/api/images/generate-all/${projectId}`);
    return res.data;
  },

  getBatchImagesStatus: async (projectId: string): Promise<{ is_running: boolean; current: number; total: number; label: string; generated: number }> => {
    const res = await client.get(`/api/images/batch-status/${projectId}`);
    return res.data;
  },

  stopBatchImages: async (projectId: string): Promise<any> => {
    const res = await client.post(`/api/images/stop-batch/${projectId}`);
    return res.data;
  },

  getThumbnails: async (projectId: string): Promise<ProjectThumbnails> => {
    const res = await client.get<ProjectThumbnails>(`/api/thumbnails/${projectId}`);
    return res.data;
  },
  
  saveThumbnails: async (projectId: string, thumbnails: any[]): Promise<ProjectThumbnails> => {
    const res = await client.post<ProjectThumbnails>(`/api/thumbnails/${projectId}/save-options`, { thumbnails });
    return res.data;
  },

  refreshThumbnailPrompts: async (projectId: string): Promise<ProjectThumbnails> => {
    const res = await client.post<ProjectThumbnails>(`/api/thumbnails/${projectId}/refresh-prompts`);
    return res.data;
  },

  generateThumbnail: async (projectId: string, thumbId: string, prompt?: string): Promise<ThumbnailOption> => {
    const res = await client.post<ThumbnailOption>(`/api/thumbnails/${projectId}/generate/${thumbId}`, { prompt });
    return res.data;
  },

  generateAllThumbnails: async (projectId: string): Promise<any> => {
    const res = await client.post(`/api/thumbnails/${projectId}/generate-all`);
    return res.data;
  },

  // Video Rendering
  renderFullVideo: async (projectId: string, speed: number = 1.2, motionEffect: string = 'zoom_in', aspect_ratio?: '16:9' | '9:16'): Promise<RenderResult> => {
    const res = await client.post<RenderResult>(`/api/video/render-full/${projectId}`, { speed, motion_effect: motionEffect, aspect_ratio });
    return res.data;
  },

  getShortsPlan: async (projectId: string, speed: number = 1.2, force: boolean = false): Promise<any> => {
    const res = await client.get(`/api/video/shorts-plan/${projectId}?speed=${speed}&force=${force}`);
    return res.data;
  },

  saveShortsPlan: async (projectId: string, chunks: any[], speed: number = 1.0): Promise<any> => {
    const res = await client.post(`/api/video/shorts-plan/${projectId}`, { chunks, speed });
    return res.data;
  },

  generateBumperImage: async (projectId: string, prompt: string, outputName: string, isVertical: boolean = true): Promise<{url: string}> => {
    const res = await client.post(`/api/video/generate-bumper-image/${projectId}`, { prompt, output_name: outputName, is_vertical: isVertical });
    return res.data;
  },

  generateBumperAudio: async (projectId: string, text: string, outputName: string): Promise<{url: string}> => {
    const res = await client.post(`/api/video/generate-bumper-audio/${projectId}`, { text, output_name: outputName });
    return res.data;
  },

  renderShortsAndTikToks: async (projectId: string, speed: number = 1.2, motionEffect: string = 'zoom_in', aspect_ratio?: '16:9' | '9:16'): Promise<ShortsAndTikToksResult> => {
    const res = await client.post<ShortsAndTikToksResult>(`/api/video/render-shorts-tiktoks/${projectId}`, { speed, motion_effect: motionEffect, aspect_ratio });
    return res.data;
  },

  getDownloadUrl: (projectId: string, relPath: string): string => {
    return `${API_BASE}/api/video/download/${projectId}?rel_path=${encodeURIComponent(relPath)}`;
  },

  openFolder: async (projectId: string, subfolder: string = 'output'): Promise<{ success: boolean; path: string }> => {
    const res = await client.post<{ success: boolean; path: string }>(`/api/video/open-folder/${projectId}`, null, {
      params: { subfolder }
    });
    return res.data;
  },

  getMetadata: async (projectId: string): Promise<PublishingMetadata> => {
    const res = await client.get<PublishingMetadata>(`/api/video/metadata/${projectId}`);
    return res.data;
  },

  generateMetadata: async (projectId: string): Promise<PublishingMetadata> => {
    const res = await client.post<PublishingMetadata>(`/api/video/metadata/${projectId}/generate`);
    return res.data;
  },
};
