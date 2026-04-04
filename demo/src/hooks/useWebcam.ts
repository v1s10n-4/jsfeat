import { useRef, useState, useCallback, useEffect } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const dimensionsRef = useRef({ width: 640, height: 480 });

  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        }));
      setCameras(videoDevices);
      return videoDevices;
    } catch {
      return [];
    }
  }, []);

  const startStream = useCallback(async (deviceId?: string) => {
    try {
      // Fully stop the old stream and detach from video element
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.load(); // Force video element to reset
      }

      setError(null);

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: dimensionsRef.current.width },
          height: { ideal: dimensionsRef.current.height },
          // Use 'exact' only when user explicitly picked a camera,
          // otherwise let the browser choose (avoids breaking on
          // Continuity Camera or devices that don't support exact match)
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for the video to actually produce frames
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;
          const onPlaying = () => {
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('error', onError);
            resolve();
          };
          const onError = () => {
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('error', onError);
            reject(new Error('Video failed to play'));
          };
          video.addEventListener('playing', onPlaying);
          video.addEventListener('error', onError);
          video.play().catch(reject);
        });
      }

      const track = stream.getVideoTracks()[0];
      if (track) {
        setActiveDeviceId(track.getSettings().deviceId ?? deviceId ?? null);
      }
      setIsActive(true);

      // Re-enumerate — after permission grant, new cameras (e.g., iPhone
      // Continuity Camera sub-lenses) may become visible
      await enumerateCameras();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access webcam';
      setError(message);
      setIsActive(false);
    }
  }, [enumerateCameras]);

  const start = useCallback(async (opts: { width: number; height: number }) => {
    dimensionsRef.current = opts;
    await startStream();
  }, [startStream]);

  const switchCamera = useCallback(async (deviceId: string) => {
    await startStream(deviceId);
  }, [startStream]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  // Enumerate cameras on mount
  useEffect(() => {
    enumerateCameras();
    // Also listen for device changes (camera plugged in/out, Continuity Camera connect)
    const handler = () => { enumerateCameras(); };
    navigator.mediaDevices?.addEventListener?.('devicechange', handler);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handler);
    };
  }, [enumerateCameras]);

  return { videoRef, start, stop, isActive, error, cameras, activeDeviceId, switchCamera };
}
