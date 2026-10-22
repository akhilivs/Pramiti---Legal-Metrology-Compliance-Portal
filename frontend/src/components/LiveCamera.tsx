'use client';
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';

export interface LiveCameraHandle {
  /** Grab the current frame at the camera's full resolution as a JPEG file. */
  capture(): Promise<File | null>;
}

/** Rear-camera preview using the browser's own getUserMedia (no library needed). */
export default function LiveCamera({ ref, onError, className }: { ref?: Ref<LiveCameraHandle>; onError: () => void; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError();
      return;
    }
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => !cancelled && onError());
    // switch the camera off when the preview closes
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onError]);

  useImperativeHandle(
    ref,
    () => ({
      capture: () =>
        new Promise<File | null>((resolve) => {
          const v = video.current;
          if (!v || !v.videoWidth) return resolve(null);
          const canvas = document.createElement('canvas');
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          canvas.getContext('2d')?.drawImage(v, 0, 0);
          canvas.toBlob((b) => resolve(b && new File([b], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' })), 'image/jpeg', 0.92);
        }),
    }),
    [],
  );

  return <video ref={video} autoPlay playsInline muted className={className} />;
}
