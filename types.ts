// ---------- USER ----------
export enum UserRole {
  ADMIN = 'admin',
  VOLUNTEER = 'volunteer',
  UNKNOWN = 'unknown'
}

export interface AppUser {
  uid: string;
  isAnonymous: boolean;
  role: UserRole;
}

// ---------- WAYPOINT ----------
export enum WaypointType {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT',
  POI = 'POI',
  JUNCTION = 'JUNCTION',
  MEDICAL = 'MEDICAL',
  STAGE = 'STAGE',
  BATHROOM = 'BATHROOM'
}

export interface Waypoint {
  id: string;
  name: string;
  type: WaypointType;
  coordinates: {
    lat: number;
    lng: number;
  };

  // Phase 4
  assignedEmails: string[];

  // Phase 3
  connectedTo: string[];

  createdAt: any;
}

// ---------- INSTRUCTIONS ----------
export interface Instruction {
  id?: string;
  waypointId: string;
  volunteerEmail: string;
  message: string;
  createdAt: any;
  acknowledged: boolean;
}

export enum CrowdLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface Observation {
  id: string;
  waypointId: string;
  volunteerEmail: string;
  crowdLevel: CrowdLevel;
  message?: string;
  imageUrl?: string;
  createdAt: any; // Firestore Timestamp
  instruction?: string
  status: 'NEW' | 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED'

  aiInsight?: {
    risk: string;
    summary: string;
    actions: string[];
  };
  aiStatus?: 'PROCESSING' | 'DONE' | 'FAILED';
  imageBase64?: string;   // compressed preview
  imageWidth?: number;
  imageHeight?: number;
}

export interface AuditLog {
  id?: string;
  observationId: string;
  action: 'AI_SUGGESTED' | 'ADMIN_SENT' | 'VOLUNTEER_ACK' | 'RESOLVED' | 'EXPIRED';
  message?: string;
  createdAt: any;
}
