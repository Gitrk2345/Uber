import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Connect to socket server
      const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000');

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setConnected(true);
        // Join user's room for personalized notifications
        newSocket.emit('join', user.id);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnected(false);
      });

      setSocket(newSocket);

      // Cleanup on unmount or user change
      return () => {
        newSocket.close();
      };
    } else {
      // Disconnect socket if user is not authenticated
      if (socket) {
        socket.close();
        setSocket(null);
        setConnected(false);
      }
    }
  }, [isAuthenticated, user]);

  const emitEvent = (event, data) => {
    if (socket && connected) {
      socket.emit(event, data);
    }
  };

  const onEvent = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const offEvent = (event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  };

  const value = {
    socket,
    connected,
    emitEvent,
    onEvent,
    offEvent
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};