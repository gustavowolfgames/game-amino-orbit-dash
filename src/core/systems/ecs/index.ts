// Core @adobe/data ECS

export type { SystemDeclaration, SystemFunction } from '@adobe/data/ecs';
export { Database, Entity, Store } from '@adobe/data/ecs';

// Math types for component schemas
export { F32, I32, U32, Vec2, Vec3, Vec4 } from '@adobe/data/math';

// Observables
export { Observe } from '@adobe/data/observe';

// Inspector bridge — games set/clear the active database + dev actions
export {
  activeDb,
  activeInspectorActions,
  type InspectorAction,
  setActiveDb,
  setActiveInspectorActions,
} from './DbBridge';
