import { createContext, type ParentProps, useContext } from 'solid-js';
import { type AudioState, audioState } from './state';

const AudioContext = createContext<AudioState>();

export function AudioProvider(props: ParentProps) {
  return (
    <AudioContext.Provider value={audioState}>
      {props.children}
    </AudioContext.Provider>
  );
}

export function useAudio(): AudioState {
  const context = useContext(AudioContext);
  if (!context) {
    // Return the singleton state if used outside provider
    return audioState;
  }
  return context;
}
