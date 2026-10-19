import { createContext, type ParentComponent, useContext } from 'solid-js';

/**
 * The analytics calls core makes itself: screen enter/exit (`ScreenProvider`) and caught
 * errors (`Boundary`). The game supplies them through `CoreTrackingProvider` (in `app.tsx`,
 * from its own tracking hook), so core never imports game code. Without a provider every
 * call is a no-op.
 */
export interface CoreTracking {
  trackScreenView(params: {
    screen_name: string;
    previous_screen?: string;
  }): void;
  trackScreenExit(params: {
    screen_name: string;
    time_on_screen: number;
  }): void;
  trackError(params: {
    error_type: string;
    user_id: string;
    session_id: string;
  }): void;
}

const NO_TRACKING: CoreTracking = {
  trackScreenView: () => {},
  trackScreenExit: () => {},
  trackError: () => {},
};

const CoreTrackingContext = createContext<CoreTracking>(NO_TRACKING);

export const CoreTrackingProvider: ParentComponent<{
  tracking: CoreTracking;
}> = (props) => (
  <CoreTrackingContext.Provider value={props.tracking}>
    {props.children}
  </CoreTrackingContext.Provider>
);

export function useCoreTracking(): CoreTracking {
  return useContext(CoreTrackingContext);
}
