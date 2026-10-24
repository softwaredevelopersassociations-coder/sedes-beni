import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Upload, Video, X } from 'lucide-react';

export default function WebcamCapture({ onCapture, initialImage = '' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(initialImage);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sincronizar stream con elemento de video
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => console.error('Error al reproducir video:', err));
    }
  }, [stream, cameraActive]);

  // Limpiar stream al desmontar el componente
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Iniciar la cámara web (OC)
  const startCamera = async () => {
    setErrorMsg('');
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setCameraActive(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador bloquea la cámara web en conexiones no seguras.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });

      setStream(mediaStream);
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setCameraActive(false);
      setErrorMsg(err.message || 'No se pudo acceder a la cámara web. Asegúrate de permitir los permisos en el navegador.');
    }
  };

  // Detener la cñmara web
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  // Capturar foto desde la cñmara web
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);

    setCapturedImage(base64);
    onCapture(base64);
    stopCamera();
  };

  // Redimensionar y procesar archivo subido (Móvil o PC)
  const processUploadedFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(base64);
        onCapture(base64);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e) => {
    processUploadedFile(e.target.files && e.target.files[0]);
  };

  const resetPhoto = () => {
    stopCamera();
    setCapturedImage('');
    onCapture('');
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-3">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider self-start">
        Fotografía del Paciente
      </label>

      {/* Recuadro de Visualización */}
      <div className="w-full aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden border-2 border-dashed border-slate-300 relative flex items-center justify-center">
        {capturedImage ? (
          <img src={capturedImage} alt="Foto del paciente" className="w-full h-full object-cover" />
        ) : cameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
        ) : (
          <div className="text-center p-4 select-none">
            <Camera size={44} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-400 font-medium">Sin fotografía asignada</p>
          </div>
        )}

        {/* Canvas oculto para capturar el cuadro de video */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {errorMsg && (
        <p className="text-[11px] text-red-500 text-center">{errorMsg}</p>
      )}

      {/* Botones de Acción */}
      {capturedImage ? (
        <button
          type="button"
          onClick={resetPhoto}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors cursor-pointer"
        >
          <RefreshCw size={14} />
          Cambiar Fotografía
        </button>
      ) : cameraActive ? (
        <div className="w-full flex gap-2">
          <button
            type="button"
            onClick={capturePhoto}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-colors cursor-pointer"
          >
            <Camera size={15} />
            Capturar Foto
          </button>
          <button
            type="button"
            onClick={stopCamera}
            className="flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <X size={15} />
            Cancelar
          </button>
        </div>
      ) : (
        <div className="w-full flex flex-col sm:flex-row gap-2">
          {/* Opción 1: Cámara Web */}
          <button
            type="button"
            onClick={startCamera}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <Video size={15} />
            Activar Cámara Web
          </button>

          {/* Opción 2: Subir Archivo / Galería (Móvil / PC) */}
          <button
            type="button"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors cursor-pointer"
          >
            <Upload size={15} />
            Subir Archivo
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}