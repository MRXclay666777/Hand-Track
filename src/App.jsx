  import { useRef } from 'react';
  import HandTracker from './components/HandTracker';
  import './App.css';

  function App() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const botToken = '7752354425:AAFn5_kFS1uEpLho5J2OqEpSy965Wc_GHOs'; // Твой токен
    const chatId = '-1002572145098'; // Новый chat ID группы

    return (
      <div className="App">
        <h1>React Hand Detection</h1>
        <video ref={videoRef} style={{ display: 'none' }} />
        <canvas ref={canvasRef} />
        <HandTracker videoRef={videoRef} canvasRef={canvasRef} botToken={botToken} chatId={chatId} />
      </div>
    );
  }

  export default App;