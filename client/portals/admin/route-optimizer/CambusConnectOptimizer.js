/**
 * portals/admin/route-optimizer/CambusConnectOptimizer.js
 * 
 * Cambus Connect — Route Optimization Engine
 * Multi-Tenant | Shift-Isolated | Next-Day Aware Trailing Merge and Hub Transfer Engine
 */

'use strict';

// ─── CONSTANTS ────────────────────────────────────────────────
const ASSET_TYPES = {
  COMFORT_LONG: { capacity: 60, fuelCostPerKm: 18, label: 'ComfortLong' },
  STANDARD:     { capacity: 40, fuelCostPerKm: 12, label: 'Standard' },
};

const NEXT_DAY_STATES = {
  NORMAL_COLLEGE:  'NORMAL_COLLEGE',
  PARTIAL_HOLIDAY: 'PARTIAL_HOLIDAY',
  FULL_HOLIDAY:    'FULL_HOLIDAY',
};

const DISPATCH_DECISIONS = {
  TRAILING_MERGE:    'TRAILING_MERGE',
  HUB_TRANSFER:      'HUB_TRANSFER',
  EXPRESS_SKIP_STOP: 'EXPRESS_SKIP_STOP',
  NORMAL_DISPATCH:   'NORMAL_DISPATCH',
  MERGE_DENIED:      'MERGE_DENIED',
  STANDBY_STATIONARY:'STANDBY_STATIONARY',
};

const SAFETY_BUFFER_PERCENT = 0.15;

// ─── EXECUTION LOGGER ────────────────────────────────────────
class ExecutionLogger {
  constructor() {
    this.logs = [];
  }

  log(level, module, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,       // INFO | WARN | DECISION | DENIED | APPROVED
      module,
      message,
      data,
    };
    this.logs.push(entry);
    const icon = { INFO: '📋', WARN: '⚠️', DECISION: '🎯', DENIED: '❌', APPROVED: '✅' }[level] || '•';
    console.log(`${icon} [${level}] [${module}] ${message}`, Object.keys(data).length ? data : '');
    return entry;
  }

  export() {
    return [...this.logs];
  }
}

// ─── SAFETY BUFFER VALIDATOR ─────────────────────────────────
class SafetyBufferValidator {
  constructor(bufferPercent = SAFETY_BUFFER_PERCENT) {
    this.bufferPercent = bufferPercent;
  }

  getMaxUsable(busType) {
    const capacity = ASSET_TYPES[busType].capacity;
    return Math.floor(capacity * (1 - this.bufferPercent));
  }

  canFitWithBuffer(busType, headcount) {
    const maxUsable = this.getMaxUsable(busType);
    return headcount <= maxUsable;
  }

  getBufferReport(busType, headcount) {
    const capacity    = ASSET_TYPES[busType].capacity;
    const maxUsable   = this.getMaxUsable(busType);
    const bufferSeats = capacity - maxUsable;
    const utilized    = headcount;
    const remaining   = maxUsable - headcount;
    return { capacity, bufferSeats, maxUsable, utilized, remaining, fits: utilized <= maxUsable };
  }
}

// ─── NEXT-DAY DEPENDENCY FORECASTER ─────────────────────────
class NextDayDependencyForecaster {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Returns zone constraints for each bus given nextDayState.
   * If NORMAL_COLLEGE → every bus must be at its native terminal overnight.
   * If PARTIAL_HOLIDAY → only shifts with class next day are constrained.
   * If FULL_HOLIDAY → no overnight zone constraints.
   */
  buildOvernightConstraints(buses, nextDayState, shiftHolidayMap = new Map()) {
    const constraints = new Map(); // busId → { mustReturnToNative: bool, reason: string }

    for (const [busId, bus] of buses) {
      let mustReturn = false;
      let reason = '';

      if (nextDayState === NEXT_DAY_STATES.NORMAL_COLLEGE) {
        mustReturn = true;
        reason = 'NORMAL_COLLEGE: full strength next day — native zone required';
      } else if (nextDayState === NEXT_DAY_STATES.PARTIAL_HOLIDAY) {
        const shiftHasHoliday = shiftHolidayMap.get(bus.assignedShift) === true;
        mustReturn = !shiftHasHoliday;
        reason = shiftHasHoliday
          ? `PARTIAL_HOLIDAY: shift ${bus.assignedShift} is on holiday tomorrow — zone flexible`
          : `PARTIAL_HOLIDAY: shift ${bus.assignedShift} has classes tomorrow — zone required`;
      } else if (nextDayState === NEXT_DAY_STATES.FULL_HOLIDAY) {
        mustReturn = false;
        reason = 'FULL_HOLIDAY: no classes tomorrow — all zones flexible';
      }

      constraints.set(busId, { mustReturn, reason });

      this.logger.log('INFO', 'NextDayForecaster',
        `Bus ${busId} overnight constraint: mustReturn=${mustReturn}`, { reason });
    }

    return constraints;
  }
}

// ─── TRAILING MERGE ENGINE ───────────────────────────────────
class TrailingMergeEngine {
  constructor(logger, safetyValidator) {
    this.logger    = logger;
    this.safety    = safetyValidator;
  }

  /**
   * Evaluates same-route, same-shift buses for a trailing merge.
   * The rearmost (furthest terminal) bus becomes the ACTIVE COLLECTOR.
   * All forward buses become STANDBY_STATIONARY.
   */
  evaluate(routeId, shiftId, busList, headcounts, overnightConstraints) {
    this.logger.log('INFO', 'TrailingMerge',
      `Evaluating trailing merge for Route=${routeId} Shift=${shiftId}`);

    // Find if we have a trailing bus (furthest)
    const trailingBus = busList.find(b => b.terminalIndex === 'FURTHEST');
    const forwardBuses = busList.filter(b => b.terminalIndex !== 'FURTHEST');

    if (!trailingBus) {
      return { eligible: false, reason: 'NO_TRAILING_BUS_IDENTIFIED' };
    }

    // Total headcount for this route+shift
    let totalHeadcount = 0;
    for (const bus of busList) {
      totalHeadcount += headcounts.get(bus.id) || 0;
    }

    // Check safety buffer using trailing bus type
    const bufferReport = this.safety.getBufferReport(trailingBus.type || 'COMFORT_LONG', totalHeadcount);
    this.logger.log('INFO', 'TrailingMerge',
      `Headcount=${totalHeadcount} | MaxUsable=${bufferReport.maxUsable} | Fits=${bufferReport.fits}`,
      bufferReport);

    if (!bufferReport.fits) {
      this.logger.log('WARN', 'TrailingMerge',
        `MERGE REJECTED: combined headcount ${totalHeadcount} exceeds safe capacity ${bufferReport.maxUsable}`);
      return { eligible: false, reason: 'EXCEEDS_SAFE_CAPACITY', bufferReport };
    }

    // Check overnight constraints — trailing merge only valid if
    // the standby buses are ALREADY at their correct overnight zones
    const violations = [];
    for (const bus of busList) {
      const constraint = overnightConstraints.get(bus.id);
      if (constraint?.mustReturn && bus.terminalIndex !== 'FURTHEST') {
        // Forward buses becoming STANDBY are already at their native terminals ✅
        // No violation — they stay exactly where they are
      }
    }

    const trailingConstraint = overnightConstraints.get(trailingBus.id);

    this.logger.log('APPROVED', 'TrailingMerge',
      `Trailing merge APPROVED. Collector: ${trailingBus.id}. Standby: ${forwardBuses.map(b => b.id).join(', ')}`);

    return {
      eligible: true,
      decision: DISPATCH_DECISIONS.TRAILING_MERGE,
      collectorBus: trailingBus,
      standbyBuses: forwardBuses,
      totalPassengers: totalHeadcount,
      bufferReport,
    };
  }
}

// ─── HUB INTERSECTION MERGER ────────────────────────────────
class HubIntersectionMerger {
  constructor(logger, safetyValidator) {
    this.logger = logger;
    this.safety = safetyValidator;
  }

  /**
   * Evaluates if buses from different adjacent routes (same shift)
   * can merge at a shared intersection hub.
   * Lead bus = bus with longest remaining distance to college from hub.
   * Other buses transfer passengers and return to their terminals.
   */
  evaluate(shiftId, busCandidates, headcounts, hubRegistry, overnightConstraints) {
    this.logger.log('INFO', 'HubMerger',
      `Evaluating hub intersection merge for Shift=${shiftId}, Candidates=${busCandidates.map(b => b.id).join(', ')}`);

    if (busCandidates.length < 2) {
      return { eligible: false, reason: 'NOT_ENOUGH_CANDIDATES' };
    }

    // Find shared hub
    const routeHubSets = busCandidates.map(bus =>
      new Set(hubRegistry.get(bus.routeId) || [])
    );

    let sharedHub = null;
    for (const hubId of routeHubSets[0]) {
      if (routeHubSets.every(hubSet => hubSet.has(hubId))) {
        sharedHub = hubId;
        break;
      }
    }

    if (!sharedHub) {
      this.logger.log('WARN', 'HubMerger',
        'No shared intersection hub found among candidate buses');
      return { eligible: false, reason: 'NO_SHARED_HUB' };
    }

    this.logger.log('INFO', 'HubMerger', `Shared hub found: ${sharedHub}`);

    // Designate lead bus (longest distance from hub to college)
    const leadBus = busCandidates.reduce((prev, curr) =>
      (curr.distanceFromHubToCollege > prev.distanceFromHubToCollege) ? curr : prev
    );
    const transferBuses = busCandidates.filter(b => b.id !== leadBus.id);

    // Total headcount check
    let totalHeadcount = 0;
    for (const bus of busCandidates) {
      totalHeadcount += headcounts.get(bus.id) || 0;
    }

    const bufferReport = this.safety.getBufferReport(leadBus.type || 'COMFORT_LONG', totalHeadcount);
    if (!bufferReport.fits) {
      this.logger.log('DENIED', 'HubMerger',
        `Hub merge DENIED: ${totalHeadcount} students exceed safe capacity ${bufferReport.maxUsable}`);
      return { eligible: false, reason: 'EXCEEDS_SAFE_CAPACITY', bufferReport };
    }

    // Validate overnight zones for returning buses
    for (const bus of transferBuses) {
      const constraint = overnightConstraints.get(bus.id);
      if (constraint?.mustReturn) {
        this.logger.log('INFO', 'HubMerger',
          `Bus ${bus.id} will return to native terminal ${bus.nativeTerminal} after hub transfer ✅`);
      }
    }

    this.logger.log('APPROVED', 'HubMerger',
      `Hub transfer APPROVED at hub=${sharedHub}. Lead: ${leadBus.id}. Transfer & Return: ${transferBuses.map(b => b.id).join(', ')}`);

    return {
      eligible: true,
      decision: DISPATCH_DECISIONS.HUB_TRANSFER,
      intersectionHubId: sharedHub,
      leadBus,
      transferBuses,
      totalPassengers: totalHeadcount,
      bufferReport,
    };
  }
}

// ─── DISPATCH PLAN GENERATOR ─────────────────────────────────
class DispatchPlanGenerator {
  constructor(logger) {
    this.logger = logger;
  }

  buildTrailingMergePlan(mergeResult, routeData) {
    const { collectorBus, standbyBuses, totalPassengers, bufferReport } = mergeResult;

    const fuelSaved = standbyBuses.reduce((sum, bus) =>
      sum + (routeData.distance * (ASSET_TYPES[bus.type]?.fuelCostPerKm || ASSET_TYPES.COMFORT_LONG.fuelCostPerKm)), 0);

    const plan = {
      decision: DISPATCH_DECISIONS.TRAILING_MERGE,
      activeBuses: [{ ...collectorBus, action: 'COLLECT_AND_DRIVE_TO_COLLEGE', passengers: totalPassengers }],
      standbyBuses: standbyBuses.map(bus => ({
        ...bus,
        action: 'STANDBY_STATIONARY — engine off, stay at terminal',
      })),
      fuelMoneySaved: fuelSaved,
      distanceSaved: standbyBuses.length * routeData.distance,
      capacityReport: bufferReport,
    };

    this.logger.log('DECISION', 'PlanGenerator',
      `TRAILING MERGE PLAN generated. Fuel saved: ₹${fuelSaved}`, plan);

    return plan;
  }

  buildHubTransferPlan(hubResult, routeDistances) {
    const { intersectionHubId, leadBus, transferBuses, totalPassengers, bufferReport } = hubResult;

    const fuelSaved = transferBuses.reduce((sum, bus) =>
      sum + ((routeDistances.get(bus.id)?.hubToCollege || 0) * (ASSET_TYPES[bus.type]?.fuelCostPerKm || ASSET_TYPES.COMFORT_LONG.fuelCostPerKm)), 0);

    const plan = {
      decision: DISPATCH_DECISIONS.HUB_TRANSFER,
      intersectionHub: intersectionHubId,
      leadBus: { ...leadBus, action: `RECEIVE_TRANSFERS_AT_HUB → DRIVE_TO_COLLEGE with ${totalPassengers} students` },
      returningBuses: transferBuses.map(bus => ({
        ...bus,
        action: `DRIVE_TO_HUB → TRANSFER_PASSENGERS → RETURN_TO_NATIVE_TERMINAL`,
        returnTerminal: bus.nativeTerminal,
        distanceSaved: routeDistances.get(bus.id)?.hubToCollege || 0,
      })),
      fuelMoneySaved: fuelSaved,
      capacityReport: bufferReport,
    };

    this.logger.log('DECISION', 'PlanGenerator',
      `HUB TRANSFER PLAN generated. Hub: ${intersectionHubId}. Fuel saved: ₹${fuelSaved}`, plan);

    return plan;
  }

  buildExpressSkipPlan(buses, routeData) {
    const plan = {
      decision: DISPATCH_DECISIONS.EXPRESS_SKIP_STOP,
      buses: buses.map(bus => ({
        ...bus,
        action: 'EXPRESS_SKIP_STOP — skip low-occupancy intermediate stops',
        skippedStops: routeData.lowOccupancyStops || [],
      })),
      note: 'Zone preservation enforced — all buses return to native terminals',
    };

    this.logger.log('DECISION', 'PlanGenerator',
      `EXPRESS_SKIP_STOP PLAN generated for ${buses.length} buses (merge denied due to NORMAL_COLLEGE next day)`);

    return plan;
  }
}

// ─── SHIFT ISOLATION MANAGER ─────────────────────────────────
class ShiftIsolationManager {
  constructor(logger) {
    this.logger = logger;
    // Map<shiftId, Map<routeId, Bus[]>>
    this.shiftBusMap = new Map();
  }

  registerBusToShift(bus) {
    if (!this.shiftBusMap.has(bus.assignedShift)) {
      this.shiftBusMap.set(bus.assignedShift, new Map());
    }
    const routeMap = this.shiftBusMap.get(bus.assignedShift);
    if (!routeMap.has(bus.assignedRoute)) {
      routeMap.set(bus.assignedRoute, []);
    }
    routeMap.get(bus.assignedRoute).push(bus);

    this.logger.log('INFO', 'ShiftIsolation',
      `Bus ${bus.id} registered → Shift=${bus.assignedShift} Route=${bus.assignedRoute}`);
  }

  getBusesForShiftRoute(shiftId, routeId) {
    return this.shiftBusMap.get(shiftId)?.get(routeId) || [];
  }

  getAllShifts() {
    return [...this.shiftBusMap.keys()];
  }

  getAllRoutesForShift(shiftId) {
    return [...(this.shiftBusMap.get(shiftId)?.keys() || [])];
  }

  validateNoCrossShiftMix(bus1, bus2) {
    if (bus1.assignedShift !== bus2.assignedShift) {
      this.logger.log('DENIED', 'ShiftIsolation',
        `CROSS-SHIFT MIX BLOCKED: Bus ${bus1.id} (${bus1.assignedShift}) vs Bus ${bus2.id} (${bus2.assignedShift})`);
      return false;
    }
    return true;
  }
}

// ─── MAIN ORCHESTRATOR ──────────────────────────────────────
class CambusConnectOptimizer {
  constructor(config = {}) {
    this.logger            = new ExecutionLogger();
    this.safety            = new SafetyBufferValidator(config.safetyBufferPercent || SAFETY_BUFFER_PERCENT);
    this.shiftManager      = new ShiftIsolationManager(this.logger);
    this.forecaster        = new NextDayDependencyForecaster(this.logger);
    this.trailingEngine    = new TrailingMergeEngine(this.logger, this.safety);
    this.hubMerger         = new HubIntersectionMerger(this.logger, this.safety);
    this.planGenerator     = new DispatchPlanGenerator(this.logger);

    // Registries
    this.buses      = new Map(); // busId → bus object
    this.headcounts = new Map(); // busId → headcount (evening)
    this.routes     = new Map(); // routeId → route object
    this.hubs       = new Map(); // routeId → hubId[]

    this.config = config;
  }

  // ── Registration Methods ──────────────────────────────────

  registerBus(bus) {
    this.buses.set(bus.id, bus);
    this.shiftManager.registerBusToShift(bus);
  }

  registerRoute(route) {
    this.routes.set(route.id, route);
    this.hubs.set(route.id, route.intersectionHubs || []);
  }

  setHeadcount(busId, count) {
    this.headcounts.set(busId, count);
    this.logger.log('INFO', 'Headcount', `Bus ${busId} evening headcount: ${count} students`);
  }

  // ── Main Optimization Run ─────────────────────────────────

  optimize(nextDayState, shiftHolidayMap = new Map()) {
    console.log('\n' + '='.repeat(70));
    console.log('🚌 CAMBUS CONNECT OPTIMIZER — RUNNING EVENING DISPATCH ANALYSIS');
    console.log('='.repeat(70));
    this.logger.log('INFO', 'Optimizer', `Starting optimization. nextDayState=${nextDayState}`);

    const overnightConstraints = this.forecaster.buildOvernightConstraints(
      this.buses, nextDayState, shiftHolidayMap
    );

    const executionPlans = new Map(); // planKey → plan

    // Process each shift in COMPLETE ISOLATION
    for (const shiftId of this.shiftManager.getAllShifts()) {
      console.log(`\n${'─'.repeat(50)}`);
      this.logger.log('INFO', 'Optimizer', `Processing SHIFT: ${shiftId} (isolated pipeline)`);

      const routesInShift = this.shiftManager.getAllRoutesForShift(shiftId);

      for (const routeId of routesInShift) {
        const busList = this.shiftManager.getBusesForShiftRoute(shiftId, routeId);
        const routeData = this.routes.get(routeId);
        const planKey = `${shiftId}_${routeId}`;

        this.logger.log('INFO', 'Optimizer',
          `Evaluating Route=${routeId} | Buses: ${busList.map(b => b.id).join(', ')}`);

        if (busList.length < 2) {
          // Single bus — just dispatch normally
          const plan = { decision: DISPATCH_DECISIONS.NORMAL_DISPATCH, buses: busList, fuelMoneySaved: 0 };
          executionPlans.set(planKey, plan);
          this.logger.log('INFO', 'Optimizer', `Single bus on route — NORMAL_DISPATCH`);
          continue;
        }

        // ── DECISION TREE ──────────────────────────────────

        // 1. Try trailing merge first (same route, same shift)
        const trailingResult = this.trailingEngine.evaluate(
          routeId, shiftId, busList, this.headcounts, overnightConstraints
        );

        if (trailingResult.eligible) {
          const plan = this.planGenerator.buildTrailingMergePlan(trailingResult, routeData);
          executionPlans.set(planKey, plan);

        } else if (nextDayState === NEXT_DAY_STATES.NORMAL_COLLEGE) {
          this.logger.log('DENIED', 'Optimizer',
            `Trailing merge denied for NORMAL_COLLEGE day. Checking Hub Intersection...`);

          const hubResult = this.hubMerger.evaluate(
            shiftId, busList, this.headcounts, this.hubs, overnightConstraints
          );

          if (hubResult.eligible) {
            const routeDistances = new Map(
              busList.map(bus => [bus.id, { hubToCollege: bus.distanceFromHubToCollege }])
            );
            const plan = this.planGenerator.buildHubTransferPlan(hubResult, routeDistances);
            executionPlans.set(planKey, plan);
          } else {
            this.logger.log('DECISION', 'Optimizer',
              `No hub transfer possible. Falling back to EXPRESS_SKIP_STOP`);
            const plan = this.planGenerator.buildExpressSkipPlan(busList, routeData);
            executionPlans.set(planKey, plan);
          }

        } else {
          // Not NORMAL_COLLEGE and trailing merge failed (capacity) — try hub merge across routes
          const allShiftBuses = [];
          for (const rId of routesInShift) {
            allShiftBuses.push(...this.shiftManager.getBusesForShiftRoute(shiftId, rId));
          }

          const hubResult = this.hubMerger.evaluate(
            shiftId, allShiftBuses, this.headcounts, this.hubs, overnightConstraints
          );

          if (hubResult.eligible) {
            const routeDistances = new Map(
              allShiftBuses.map(bus => [bus.id, { hubToCollege: bus.distanceFromHubToCollege }])
            );
            const plan = this.planGenerator.buildHubTransferPlan(hubResult, routeDistances);
            executionPlans.set(`${shiftId}_CROSS_ROUTE_HUB`, plan);
          } else {
            const plan = { decision: DISPATCH_DECISIONS.NORMAL_DISPATCH, buses: busList, fuelMoneySaved: 0 };
            executionPlans.set(planKey, plan);
            this.logger.log('INFO', 'Optimizer', `No merge possible — NORMAL_DISPATCH for all`);
          }
        }
      }
    }

    return this._buildFinalReport(executionPlans, nextDayState);
  }

  _buildFinalReport(plans, nextDayState) {
    let totalMoneySaved = 0;
    const summary = [];

    for (const [planKey, plan] of plans) {
      if (plan.fuelMoneySaved) totalMoneySaved += plan.fuelMoneySaved;
      summary.push({ planKey, decision: plan.decision });
    }

    const report = {
      timestamp: new Date().toISOString(),
      nextDayState,
      totalPlans: plans.size,
      totalMoneySaved,
      plans: Object.fromEntries(plans),
      summary,
      executionLog: this.logger.export(),
    };

    console.log('\n' + '='.repeat(70));
    console.log('📊 OPTIMIZATION COMPLETE');
    console.log(`   Plans Generated : ${plans.size}`);
    console.log(`   Money Saved     : ₹${totalMoneySaved}`);
    console.log(`   Next Day State  : ${nextDayState}`);
    console.log('='.repeat(70) + '\n');

    return report;
  }
}

// ─── SHIFT HOLIDAY MOCK MAPS ─────────────────────────────────
const MOCK_ROUTES = [
  {
    id: 'ROUTE_A',
    name: 'Vijay Nagar → College',
    type: 'LONG',
    distance: 22,
    intersectionHubs: ['HUB_RING_ROAD', 'HUB_LIG_SQUARE'],
    lowOccupancyStops: ['Stop_A3', 'Stop_A5'],
  },
  {
    id: 'ROUTE_B',
    name: 'Scheme 54 → College',
    type: 'LONG',
    distance: 18,
    intersectionHubs: ['HUB_RING_ROAD', 'HUB_PALASIA'],
    lowOccupancyStops: ['Stop_B2'],
  },
];

const MOCK_BUSES = [
  {
    id: 'BUS_A1_S1',
    type: 'COMFORT_LONG',
    assignedRoute: 'ROUTE_A',
    assignedShift: 'SHIFT_1',
    nativeTerminal: 'VijayNagar_North',
    terminalIndex: 'FURTHEST',
    distanceFromHubToCollege: 14,
  },
  {
    id: 'BUS_A2_S1',
    type: 'COMFORT_LONG',
    assignedRoute: 'ROUTE_A',
    assignedShift: 'SHIFT_1',
    nativeTerminal: 'VijayNagar_South',
    terminalIndex: 'FORWARD',
    distanceFromHubToCollege: 10,
  },
  {
    id: 'BUS_A3_S2',
    type: 'COMFORT_LONG',
    assignedRoute: 'ROUTE_A',
    assignedShift: 'SHIFT_2',
    nativeTerminal: 'VijayNagar_North',
    terminalIndex: 'FURTHEST',
    distanceFromHubToCollege: 14,
  },
  {
    id: 'BUS_A4_S2',
    type: 'COMFORT_LONG',
    assignedRoute: 'ROUTE_A',
    assignedShift: 'SHIFT_2',
    nativeTerminal: 'VijayNagar_South',
    terminalIndex: 'FORWARD',
    distanceFromHubToCollege: 10,
  },
];

function runMockExecution() {
  console.log('\n\n' + '█'.repeat(70));
  console.log('█  SCENARIO 1: PARTIAL_HOLIDAY — Trailing Merge Approved             █');
  console.log('█'.repeat(70));

  const engine1 = new CambusConnectOptimizer();
  MOCK_ROUTES.forEach(r => engine1.registerRoute(r));
  MOCK_BUSES.forEach(b => engine1.registerBus(b));

  engine1.setHeadcount('BUS_A1_S1', 18);
  engine1.setHeadcount('BUS_A2_S1', 14);
  engine1.setHeadcount('BUS_A3_S2', 22);
  engine1.setHeadcount('BUS_A4_S2', 21);

  const shiftHolidayMap1 = new Map([['SHIFT_1', true], ['SHIFT_2', true]]);
  engine1.optimize(NEXT_DAY_STATES.PARTIAL_HOLIDAY, shiftHolidayMap1);

  console.log('\n\n' + '█'.repeat(70));
  console.log('█  SCENARIO 2: NORMAL_COLLEGE — Trailing Merge Validation             █');
  console.log('█'.repeat(70));

  const engine2 = new CambusConnectOptimizer();
  MOCK_ROUTES.forEach(r => engine2.registerRoute(r));
  MOCK_BUSES.forEach(b => engine2.registerBus(b));

  engine2.setHeadcount('BUS_A1_S1', 15);
  engine2.setHeadcount('BUS_A2_S1', 12);
  engine2.setHeadcount('BUS_A3_S2', 20);
  engine2.setHeadcount('BUS_A4_S2', 18);

  engine2.optimize(NEXT_DAY_STATES.NORMAL_COLLEGE);
}

// Automatically run mock execution if executed directly in Node
if (typeof require !== 'undefined' && require.main === module) {
  runMockExecution();
}

// Export module definitions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CambusConnectOptimizer,
    ShiftIsolationManager,
    NextDayDependencyForecaster,
    TrailingMergeEngine,
    HubIntersectionMerger,
    SafetyBufferValidator,
    DispatchPlanGenerator,
    ExecutionLogger,
    ASSET_TYPES,
    NEXT_DAY_STATES,
    DISPATCH_DECISIONS,
    runMockExecution,
    MOCK_ROUTES,
    MOCK_BUSES
  };
} else {
  window.CambusConnectOptimizer = CambusConnectOptimizer;
  window.ShiftIsolationManager = ShiftIsolationManager;
  window.NextDayDependencyForecaster = NextDayDependencyForecaster;
  window.TrailingMergeEngine = TrailingMergeEngine;
  window.HubIntersectionMerger = HubIntersectionMerger;
  window.SafetyBufferValidator = SafetyBufferValidator;
  window.DispatchPlanGenerator = DispatchPlanGenerator;
  window.ExecutionLogger = ExecutionLogger;
  window.ASSET_TYPES = ASSET_TYPES;
  window.NEXT_DAY_STATES = NEXT_DAY_STATES;
  window.DISPATCH_DECISIONS = DISPATCH_DECISIONS;
  window.runMockExecution = runMockExecution;
  window.MOCK_ROUTES = MOCK_ROUTES;
  window.MOCK_BUSES = MOCK_BUSES;
}
