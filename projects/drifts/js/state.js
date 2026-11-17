// Shared app state and configuration (ATS, G29 wheel).

// ============================================================================
// UNIFIED STATE: STAGE 1 (PHONE SENSORS) + STAGE 2 (FACE DETECTION GATE)
// ============================================================================
const CIRC = 2 * Math.PI * 38;

const appState = {
  // Pipeline stage: 'stage1_sentinel' | 'stage2_verifying' | 'stage3_intervention'
  pipelineStage: 'stage1_sentinel',

  // Stage 1: Phone Telemetry
  hardwareSensorsBound: false,
  speedMph: 0,          // latest speed (GPS, or ATS telemetry)
  speedAt: 0,
  lastFaceCheckAt: 0,   // last time the camera checked the driver (routine checks count from here)           // when speedMph was last updated (ms); stale after a few seconds
  accelG: 1.00,
  gyroRate: 0.0,
  drivingAnomalyScore: 0, // 0 - 100 (Triggers Stage 2 when > 50)
  anomalyDecayRate: 1.15,

  // Stage 2: Face Detection (MediaPipe Live Camera)
  visionActive: false,
  webcamRunning: false,
  faceDetected: false,
  ear: 0.31,
  yaw: 0,
  pitch: 0,
  pitchBaseline: null,
  yawBaseline: null,
  perclos: 0,
  closedFramesWindow: [],
  clearFaceSeconds: 0,
  cameraCheckDuration: 7,
  eyesClosedSince: null,    // when the current eye closure began (performance.now ms)
  eyesClosedFor: 0,         // seconds the eyes have been closed right now
  cameraWokeAt: null,
  lockoutStartedAt: null,

  // Fusion Score & Interventions
  alertnessScore: 100,    // UFAS shown on the gauge (min of ceiling and live score)
  liveScore: 100,         // instantaneous fusion score, drives interventions
  sessionActive: false,
  sessionStartedAt: null,
  ufasCeiling: 100,       // drops 25 per camera alert, recovers slowly
  cameraAlerts: 0,
  lockoutActive: false,
  lockoutCount: 0,
  seatActive: false,
  audioActive: false,
  criticalStateStart: null,

  // Buzzer Audio Customization
  sirenVolume: 0.70,
  sirenFreq: 880,
  sirenWave: 'sawtooth',
  gpsWatchId: null,

  // Stage 1b: Logitech G29 Wheel (Gamepad API)
  wheelBound: false,
  wheelLinkRequested: false,
  wheelIndex: null,
  steerDeg: 0,
  steerRate: 0,           // smoothed deg/s at the wheel rim
  throttle: 0,            // 0..1
  brake: 0,               // 0..1
  clutch: 0,              // 0..1
  steerStillSeconds: 0,
  steerReversalsPerMin: 0,
  lastAnomalyReason: null,

  // Stage 1c: American Truck Simulator (WebSocket bridge)
  atsWanted: false,
  atsConnected: false,
  atsGameLive: false,
  atsCollisions: 0,
  atsFines: 0,
  atsCollisionScore: 100,
  atsDamagePct: 0,
  lastAnomalySource: null,   // 'S' phone sensors, 'W' wheel, 'A' ATS (sent to the module)

  // Bluetooth output module
  bleConnected: false,
  bleWantConnected: false,
  bleLinkPending: false
};

// ============================================================================
// ATS CONFIGURATION — how game events feed the Stage 1 anomaly score
// ============================================================================
const ATS_CONFIG = {
  collisionImpulse: 60,            // any collision wakes the camera (>= 50)
  scorePenaltyBase: 5,             // collision score lost per hit…
  scorePenaltyPerDamagePct: 3,     // …plus this much per % of damage the hit caused
  scorePenaltyMax: 25,
  // Fines: offence name from the SCS SDK -> anomaly points
  fineImpulse: {
    avoid_sleeping: 60,            // ATS fatigue fine: directly relevant to drowsiness
    wrong_way: 50,
    red_signal: 35,
    hard_shoulder_violation: 35,
    crash: 0,                      // already counted as a collision
    default: 20
  },
  reconnectMs: 3000
};

// ============================================================================
// G29 CONFIGURATION — use g29-tester.html to confirm axis numbers on your PC
// ============================================================================
const WHEEL_CONFIG = {
  // Axis mapping (Chrome/Edge on Windows defaults for the G29)
  steerAxis: 0,
  steerInvert: false,
  rangeDeg: 900,            // must match G HUB "Operating Range"
  throttleAxis: 2,
  brakeAxis: 5,
  clutchAxis: 1,
  pedalsInverted: true,     // G29 pedals read +1 at rest, -1 fully pressed

  // 1) Swerve: steering wheel spun faster than this (deg/s at the rim)
  swerveRateDegPerSec: 540,
  swerveImpulse: 55,        // anomaly points added (>= 50 wakes the camera on its own)

  // 2) Drowsy "drift then jerk" pattern: hands go still while driving,
  //    then a sudden large correction. Classic microsleep steering signature.
  stillAngleDeg: 1.0,       // movement smaller than this counts as "still"
  stillSeconds: 3.5,        // how long hands must be still to arm the check
  minThrottleForStill: 0.08,// only counts while on the throttle (car moving)
  correctionDeg: 25,        // correction size that fires the event…
  correctionWindowSec: 0.6, // …if it happens within this long after stillness ends
  correctionImpulse: 60,

  // 3) Panic brake: brake goes from released to hard within a short window
  hardBrakeLevel: 0.70,
  hardBrakeWindowMs: 400,
  hardBrakeImpulse: 35,     // below 50 alone; combines with other events

  // Steering reversal rate (info + light contribution when very erratic)
  reversalGapDeg: 2.0,
  erraticReversalsPerMin: 45,

  eventCooldownSec: 1.5     // minimum time between repeat events of the same type
};

const wheelState = {
  lastSteerDeg: null,
  stillAnchorDeg: 0,
  stillStart: performance.now(),
  correction: null,         // { start, baseDeg } while a post-stillness window is open
  reversalDir: 0,
  reversalExtreme: 0,
  reversalTimes: [],
  brakeLowTime: performance.now(),
  pedalSeen: {},            // some browsers report 0 until a pedal first moves
  lastEvent: {}
};
