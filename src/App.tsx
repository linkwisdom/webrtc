import React, { useEffect, useRef, useState } from 'react';
import { Video, Phone, PhoneOff, VideoOff, Download } from 'lucide-react';
import io from 'socket.io-client';

const App: React.FC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<SocketIOClient.Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    socketRef.current = io('http://local.ai-tutor.cn:5000');

    socketRef.current.on('offer', async (offer: RTCSessionDescriptionInit) => {
      if (!peerConnectionRef.current) {
        createPeerConnection();
      }
      await peerConnectionRef.current!.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnectionRef.current!.createAnswer();
      await peerConnectionRef.current!.setLocalDescription(answer);
      socketRef.current!.emit('answer', answer);
    });

    socketRef.current.on('answer', async (answer: RTCSessionDescriptionInit) => {
      await peerConnectionRef.current!.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socketRef.current.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      await peerConnectionRef.current!.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const createPeerConnection = () => {
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current!.emit('ice-candidate', event.candidate);
      }
    };

    peerConnectionRef.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    localStream!.getTracks().forEach((track) => {
      peerConnectionRef.current!.addTrack(track, localStream!);
    });
  };

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  const startCall = async () => {
    if (!localStream) {
      await startVideo();
    }
    createPeerConnection();
    const offer = await peerConnectionRef.current!.createOffer();
    await peerConnectionRef.current!.setLocalDescription(offer);
    socketRef.current!.emit('offer', offer);
    setIsConnected(true);
  };

  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
  };

  const startRecording = () => {
    if (!localStream) return;

    recordedChunksRef.current = [];
    const mediaRecorder = new MediaRecorder(localStream, { mimeType: 'video/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.start();
    setIsRecording(true);
    mediaRecorderRef.current = mediaRecorder;
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    setIsRecording(false);

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.style.display = 'none';
      a.href = url;
      a.download = 'recorded-video.webm';
      a.click();
      window.URL.revokeObjectURL(url);
    };
  };

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">WebRTC Remote Video</h1>
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        <div className="relative">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-80 h-60 bg-black rounded-lg shadow-lg"
          />
          <p className="absolute bottom-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded">Local</p>
        </div>
        <div className="relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-80 h-60 bg-black rounded-lg shadow-lg"
          />
          <p className="absolute bottom-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded">Remote</p>
        </div>
      </div>
      <div className="flex gap-4">
        {!localStream && (
          <button
            onClick={startVideo}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded flex items-center"
          >
            <Video className="mr-2" /> Start Video
          </button>
        )}
        {localStream && !isConnected && (
          <button
            onClick={startCall}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded flex items-center"
          >
            <Phone className="mr-2" /> Start Call
          </button>
        )}
        {isConnected && (
          <button
            onClick={endCall}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded flex items-center"
          >
            <PhoneOff className="mr-2" /> End Call
          </button>
        )}
        {localStream && !isRecording && (
          <button
            onClick={startRecording}
            className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded flex items-center"
          >
            <Video className="mr-2" /> Start Recording
          </button>
        )}
        {isRecording && (
          <button
            onClick={stopRecording}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded flex items-center"
          >
            <VideoOff className="mr-2" /> Stop Recording
          </button>
        )}
      </div>
    </div>
  );
};

export default App;