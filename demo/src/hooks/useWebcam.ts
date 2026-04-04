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
      const video = videoRef.current;
      if (video) {
        // Pause first to avoid "play() interrupted by load" error
        video.pause();
        video.srcObject = null;
      }

      setError(null);

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: dimensionsRef.current.width },
          height: { ideal: dimensionsRef.current.height },
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (video) {
        video.srcObject = stream;
        // Wait for enough data to be loaded before playing
        await new Promise<void>((resolve) => {
          const onCanPlay = () => {
            video.removeEventListener('canplay', onCanPlay);
            resolve();
          };
          // If already ready (e.g., re-using same device), resolve immediately
          if (video.readyState >= 3) {
            resolve();
          } else {
            video.addEventListener('canplay', onCanPlay);
          }
        });
        await video.play();
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
