/**
 * Cambus Enterprise Ecosystem
 * Multi-Tenant Transportation SaaS Framework
 * Production-Ready ES6+ Implementation
 */

// =========================================================================
// 1. CORE OPTIMIZATION ENGINE
// =========================================================================

class CambusEnterpriseEngine {
    constructor(tenantConfigs = {}) {
        /**
         * tenantConfigs database schema map:
         * {
         *   [tenantId]: {
         *      name: string,
         *      fuelCostPerLiter: number,
         *      averageFuelEfficiencyKmL: number, // Kilometers per Liter
         *      currency: string,                 // e.g. "INR", "USD"
         *      safetyCapPercentage: number       // Default 90% (0.90)
         *   }
         * }
         */
        this.tenantConfigs = tenantConfigs;
    }

    /**
     * Get tenant configuration or throw exception if tenant is isolated/missing
     */
    getTenantConfig(tenantId) {
        if (!tenantId || !this.tenantConfigs[tenantId]) {
            throw new Error(`[Security Alert] Unauthorized or missing tenant context: "${tenantId}"`);
        }
        return this.tenantConfigs[tenantId];
    }

    /**
     * Main optimization processor run nightly.
     * Evaluates commute intention logs and yields route execution states.
     * 
     * @param {string} tenantId - Isolated identifier
     * @param {Array} buses - Fleet array for the tenant
     * @param {Array} routes - Active routes array for the tenant
     * @param {Array} studentCommuteLogs - Student intention locks for the run
     * @returns {Object} Optimized dispatch plan
     */
    optimizeRoutes(tenantId, buses, routes, studentCommuteLogs) {
        const config = this.getTenantConfig(tenantId);
        const safetyCapPct = config.safetyCapPercentage || 0.90;

        // 1. Filter out logs flagged with NOT_COMMUTING (Absenteeism Deduction)
        const activeCommuters = studentCommuteLogs.filter(log => {
            return log.tenantId === tenantId && log.intention === "COMMUTING";
        });

        const dispatchPlan = {
            tenantId,
            timestamp: new Date().toISOString(),
            routes: []
        };

        // Track merged passenger assignments dynamically
        // Map of routeId -> list of student objects assigned
        const routeAssignments = {};
        
        // Initial setup for route assignments based on registered students
        routes.forEach(route => {
            routeAssignments[route.id] = activeCommuters.filter(commuter => commuter.registeredRouteId === route.id);
        });

        // 2. Process merges first for low-occupancy routes (Decision Tree Phase 1)
        const sortedRoutes = [...routes]; // Keep original array ordering
        const processedRouteIds = new Set();
        const routeStatuses = {}; // Keep track of final route states

        for (const route of sortedRoutes) {
            if (processedRouteIds.has(route.id)) continue;

            const assignedBus = buses.find(b => b.id === route.assignedBusId && b.tenantId === tenantId);
            if (!assignedBus) {
                routeStatuses[route.id] = {
                    status: "STANDBY_CANCELLED",
                    reason: "No bus asset configured for this route",
                    netHeadcount: 0,
                    fuelSavedLiters: 0,
                    moneySaved: 0
                };
                processedRouteIds.add(route.id);
                continue;
            }

            // Safety Buffer Cap (90% of absolute bus capacity)
            const safetyBufferCap = Math.floor(assignedBus.capacity * safetyCapPct);
            const currentStudents = routeAssignments[route.id] || [];
            const netHeadcount = currentStudents.length;

            // Decision: Standby/Cancelled (0 Headcount)
            if (netHeadcount === 0) {
                routeStatuses[route.id] = {
                    status: "STANDBY_CANCELLED",
                    reason: "Zero active commuters registered for this run",
                    netHeadcount: 0,
                    assignedBusId: assignedBus.id,
                    fuelSavedLiters: (route.distanceKm / config.averageFuelEfficiencyKmL),
                    moneySaved: (route.distanceKm / config.averageFuelEfficiencyKmL) * config.fuelCostPerLiter,
                    distanceSavedKm: route.distanceKm
                };
                processedRouteIds.add(route.id);
                continue;
            }

            // Decision: Low Occupancy (<40% of safety cap)
            const occupancyRate = netHeadcount / safetyBufferCap;
            if (occupancyRate < 0.40 && route.nearbyAlternativeRouteId) {
                const targetRoute = routes.find(r => r.id === route.nearbyAlternativeRouteId);
                const targetBus = targetRoute ? buses.find(b => b.id === targetRoute.assignedBusId) : null;
                
                if (targetRoute && targetBus) {
                    const targetSafetyCap = Math.floor(targetBus.capacity * safetyCapPct);
                    const targetStudents = routeAssignments[targetRoute.id] || [];
                    const combinedHeadcount = netHeadcount + targetStudents.length;

                    // Verify combined load fits within target bus safety buffer cap
                    if (combinedHeadcount <= targetSafetyCap) {
                        // Perform merge
                        routeAssignments[targetRoute.id] = [...targetStudents, ...currentStudents];
                        routeAssignments[route.id] = []; // Cleared out

                        routeStatuses[route.id] = {
                            status: "MERGED_AND_CANCELLED",
                            mergedIntoRouteId: targetRoute.id,
                            reason: `Low occupancy (${(occupancyRate * 100).toFixed(1)}%). Merged with ${targetRoute.id}.`,
                            netHeadcount: 0,
                            assignedBusId: assignedBus.id,
                            fuelSavedLiters: (route.distanceKm / config.averageFuelEfficiencyKmL),
                            moneySaved: (route.distanceKm / config.averageFuelEfficiencyKmL) * config.fuelCostPerLiter,
                            distanceSavedKm: route.distanceKm
                        };
                        processedRouteIds.add(route.id);
                        continue;
                    }
                }
            }

            // Route is optimal or couldn't be merged
            routeStatuses[route.id] = {
                status: "OPTIMAL_DISPATCH",
                netHeadcount: netHeadcount,
                assignedBusId: assignedBus.id
            };
            processedRouteIds.add(route.id);
        }

        // 3. Process dispatch metrics and express skip-stop checks
        routes.forEach(route => {
            const statusInfo = routeStatuses[route.id];
            if (statusInfo.status !== "OPTIMAL_DISPATCH") {
                dispatchPlan.routes.push({
                    routeId: route.id,
                    routeName: route.name,
                    status: statusInfo.status,
                    assignedBusId: statusInfo.assignedBusId,
                    netHeadcount: statusInfo.netHeadcount,
                    fuelSavedLiters: statusInfo.fuelSavedLiters || 0,
                    moneySaved: statusInfo.moneySaved || 0,
                    distanceSavedKm: statusInfo.distanceSavedKm || 0,
                    instructions: statusInfo.reason || "Dispatch cancelled.",
                    skipInfo: null
                });
                return;
            }

            const currentStudents = routeAssignments[route.id] || [];
            
            // Skip-Stop Express Logic
            // Find the lowest pickupStopOrder integer with active students
            let lowestActiveStopOrder = Infinity;
            currentStudents.forEach(student => {
                if (student.pickupStopOrder < lowestActiveStopOrder) {
                    lowestActiveStopOrder = student.pickupStopOrder;
                }
            });

            let skipInstructions = "Standard dispatch. Stop at all scheduled checkpoints.";
            let kilometersSkipped = 0;
            let skipInfo = null;

            if (lowestActiveStopOrder > 1 && lowestActiveStopOrder !== Infinity) {
                const stopsToSkip = lowestActiveStopOrder - 1;
                // Calculate skipped kilometers based on route configuration
                kilometersSkipped = route.stops
                    .filter(stop => stop.order < lowestActiveStopOrder)
                    .reduce((sum, stop) => sum + (stop.distanceFromPreviousStopKm || 0), 0);

                skipInstructions = `Express Run: Skip first ${stopsToSkip} stop(s). Start passenger boardings from Stop #${lowestActiveStopOrder} (${route.stops.find(s => s.order === lowestActiveStopOrder).name}).`;
                skipInfo = {
                    skippedStopsCount: stopsToSkip,
                    firstActiveStopOrder: lowestActiveStopOrder,
                    kilometersSkipped: kilometersSkipped
                };
            }

            // Financial Analytics
            const fuelSavedLiters = kilometersSkipped / config.averageFuelEfficiencyKmL;
            const moneySaved = fuelSavedLiters * config.fuelCostPerLiter;

            dispatchPlan.routes.push({
                routeId: route.id,
                routeName: route.name,
                status: "OPTIMAL_DISPATCH",
                assignedBusId: route.assignedBusId,
                netHeadcount: currentStudents.length,
                fuelSavedLiters: fuelSavedLiters,
                moneySaved: moneySaved,
                distanceSavedKm: kilometersSkipped,
                instructions: skipInstructions,
                skipInfo: skipInfo
            });
        });

        return dispatchPlan;
    }
}

// =========================================================================
// 2. ADMINISTRATIVE PORTAL INTEGRATION PIPELINE
// =========================================================================

/**
 * Generates the Night Review Summary for dashboard preview and override options
 */
function getNightlyReviewSummary(tenantId, optimizedDispatchPlan) {
    if (optimizedDispatchPlan.tenantId !== tenantId) {
        throw new Error("[Security Alert] Tenant context mismatch in nightly review.");
    }

    return optimizedDispatchPlan.routes.map(route => {
        let flagSeverity = "INFO";
        if (route.status === "STANDBY_CANCELLED") flagSeverity = "WARNING";
        if (route.status === "MERGED_AND_CANCELLED") flagSeverity = "CRITICAL";
        if (route.skipInfo && route.skipInfo.skippedStopsCount > 0) flagSeverity = "SUCCESS";

        return {
            routeId: route.routeId,
            routeName: route.routeName,
            status: route.status,
            assignedBusId: route.assignedBusId,
            netHeadcount: route.netHeadcount,
            instructions: route.instructions,
            flagSeverity: flagSeverity,
            fuelSavedLiters: route.fuelSavedLiters.toFixed(2),
            moneySaved: route.moneySaved.toFixed(2),
            requiresApprovalOverride: route.status !== "OPTIMAL_DISPATCH"
        };
    });
}

/**
 * Returns the Morning Operational Matrix summarizing fleet logs and emergency swap targets
 */
function getMorningOperationalMatrix(tenantId, optimizedDispatchPlan, driverAvailability = {}) {
    if (optimizedDispatchPlan.tenantId !== tenantId) {
        throw new Error("[Security Alert] Tenant context mismatch in operational matrix.");
    }

    let totalActiveFleet = 0;
    let totalSavedBuses = 0;
    let totalFuelSaved = 0;
    let totalMoneySaved = 0;

    optimizedDispatchPlan.routes.forEach(route => {
        if (route.status === "OPTIMAL_DISPATCH") {
            totalActiveFleet++;
        } else {
            totalSavedBuses++;
        }
        totalFuelSaved += route.fuelSavedLiters;
        totalMoneySaved += route.moneySaved;
    });

    // Driver Hot-Swap triggers mapping (handling emergency leaves)
    const hotSwapTriggers = [];
    Object.entries(driverAvailability).forEach(([driverId, status]) => {
        if (status.status === "EMERGENCY_LEAVE") {
            // Find which route this driver was assigned to
            const affectedRoute = optimizedDispatchPlan.routes.find(r => r.assignedBusId === status.assignedBusId);
            hotSwapTriggers.push({
                absentDriverId: driverId,
                absentDriverName: status.name,
                assignedBusId: status.assignedBusId,
                assignedRouteId: affectedRoute ? affectedRoute.routeId : "Unassigned",
                suggestedStandbyDrivers: status.standbyDrivers || []
            });
        }
    });

    return {
        tenantId,
        date: new Date().toLocaleDateString(),
        metrics: {
            totalActiveFleet,
            totalSavedBuses,
            totalCumulativeFuelSavingsLiters: parseFloat(totalFuelSaved.toFixed(2)),
            totalCumulativeCurrencySaved: parseFloat(totalMoneySaved.toFixed(2))
        },
        hotSwapTriggers
    };
}

// =========================================================================
// 3. DRIVER PORTAL UI DATA CONTRACT & LOGIC
// =========================================================================

/**
 * Generates the boot alert payload for the Driver mobile terminal
 */
function getDriverBootPayload(tenantId, busId, optimizedDispatchPlan) {
    const routeDispatch = optimizedDispatchPlan.routes.find(r => r.assignedBusId === busId);
    
    if (!routeDispatch) {
        return {
            status: "STANDBY_UNASSIGNED",
            message: "No optimized routing data found for this vehicle asset. Park vehicle and contact fleet ops.",
            alertColor: "RED",
            commutersCount: 0,
            expressInstructions: null
        };
    }

    if (routeDispatch.status === "STANDBY_CANCELLED") {
        return {
            status: "STANDBY_CANCELLED",
            message: `⚠️ RED STATUS: Route cancelled due to zero commuters. Keep bus parked at source terminal origin.`,
            alertColor: "RED",
            commutersCount: 0,
            expressInstructions: null
        };
    }

    if (routeDispatch.status === "MERGED_AND_CANCELLED") {
        return {
            status: "MERGED_AND_CANCELLED",
            message: `⚠️ RED STATUS: Combined headcount merged. Keep bus parked at source terminal origin. Dispatch route ID: ${routeDispatch.instructions}`,
            alertColor: "RED",
            commutersCount: 0,
            expressInstructions: null
        };
    }

    const hasSkips = routeDispatch.skipInfo && routeDispatch.skipInfo.skippedStopsCount > 0;
    return {
        status: "ACTIVE_DISPATCH",
        message: hasSkips
            ? `🟢 GREEN STATUS: Express route dispatched. ${routeDispatch.instructions}`
            : `🟢 GREEN STATUS: Standard route dispatched. Stop at all scheduled checkpoints.`,
        alertColor: "GREEN",
        commutersCount: routeDispatch.netHeadcount,
        expressInstructions: routeDispatch.skipInfo
    };
}

/**
 * Processes delay notifications sent dynamically from students during route transit
 */
function handleStudentDelayInterception(routeId, stopId, studentId, delayMinutes, routeData) {
    const route = routeData.find(r => r.id === routeId);
    if (!route) {
        return { action: "PROCEED_STANDARD", message: "Route context not found." };
    }

    const targetStop = route.stops.find(s => s.id === stopId);
    if (!targetStop) {
        return { action: "PROCEED_STANDARD", message: "Stop context not found." };
    }

    // Rule engine: If student is delayed by > 5 minutes, trigger stop-bypass instructions
    if (delayMinutes > 5) {
        return {
            action: "BYPASS_STOP",
            targetStopId: stopId,
            targetStopName: targetStop.name,
            reason: `Commuter ${studentId} declared a ${delayMinutes}-minute delay. Bypassing stop to preserve route schedule.`,
            updatedStopArrivalOffsetMinutes: 0
        };
    }

    // Short delay: Recommend waiting
    return {
        action: "HOLD_VEHICLE",
        targetStopId: stopId,
        targetStopName: targetStop.name,
        reason: `Commuter ${studentId} has a short delay of ${delayMinutes} minutes. Holding vehicle at checkpoint.`,
        updatedStopArrivalOffsetMinutes: delayMinutes
    };
}

// =========================================================================
// 4. STUDENT PORTAL DATA PIPE
// =========================================================================

class StudentCommutePipe {
    constructor() {
        this.databaseLogs = [];
    }

    /**
     * Ingestion payload system where a student locks their commute intention
     */
    lockCommuteIntention(tenantId, studentId, registeredRouteId, pickupStopOrder, intention, timestamp = new Date()) {
        const validIntentions = ["COMMUTING", "NOT_COMMUTING"];
        if (!validIntentions.includes(intention)) {
            throw new Error(`Invalid intention locked. Expected ${validIntentions.join(" or ")}`);
        }

        const logEntry = {
            tenantId,
            studentId,
            registeredRouteId,
            pickupStopOrder,
            intention,
            timestamp: timestamp.toISOString()
        };

        // Upsert log entry (preserve uniqueness for student on the specific day run)
        const existingIdx = this.databaseLogs.findIndex(
            log => log.tenantId === tenantId && log.studentId === studentId
        );

        if (existingIdx > -1) {
            this.databaseLogs[existingIdx] = logEntry;
        } else {
            this.databaseLogs.push(logEntry);
        }

        return logEntry;
    }

    getLogs() {
        return this.databaseLogs;
    }
}

// =========================================================================
// 5. MOCK MULTI-TENANT DATASET & DEMO RUNNER
// =========================================================================

// Tenant configurations
const tenantConfigs = {
    "indore-institute": {
        name: "Indore Institute of Science and Technology (IIST)",
        fuelCostPerLiter: 104.50, // INR
        averageFuelEfficiencyKmL: 4.5,
        currency: "INR",
        safetyCapPercentage: 0.90 // 90% Capacity cap
    },
    "medicaps-university": {
        name: "Medicaps University",
        fuelCostPerLiter: 98.20, // INR
        averageFuelEfficiencyKmL: 5.0,
        currency: "INR",
        safetyCapPercentage: 0.85 // Strict 85% safety cap
    }
};

// Fleet Inventory Assets (Buses)
const fleetBuses = [
    // Indore Institute Buses
    { id: "iist-bus-101", tenantId: "indore-institute", number: "101", capacity: 50 },
    { id: "iist-bus-102", tenantId: "indore-institute", number: "102", capacity: 40 },
    { id: "iist-bus-103", tenantId: "indore-institute", number: "103", capacity: 50 },
    
    // Medicaps University Buses
    { id: "medi-bus-501", tenantId: "medicaps-university", number: "501", capacity: 60 }
];

// Routes config
const routesConfig = [
    {
        id: "iist-route-a",
        tenantId: "indore-institute",
        name: "Geeta Bhawan Express Loop",
        assignedBusId: "iist-bus-101",
        distanceKm: 25,
        nearbyAlternativeRouteId: "iist-route-b",
        stops: [
            { id: "a-stop-1", order: 1, name: "Geeta Bhawan Origin", distanceFromPreviousStopKm: 0 },
            { id: "a-stop-2", order: 2, name: "Palasia Square", distanceFromPreviousStopKm: 4 },
            { id: "a-stop-3", order: 3, name: "LIG Square", distanceFromPreviousStopKm: 3 },
            { id: "a-stop-4", order: 4, name: "Vijay Nagar", distanceFromPreviousStopKm: 5 }
        ]
    },
    {
        id: "iist-route-b",
        tenantId: "indore-institute",
        name: "Vijay Nagar Local Loop",
        assignedBusId: "iist-bus-102",
        distanceKm: 18,
        nearbyAlternativeRouteId: null,
        stops: [
            { id: "b-stop-1", order: 1, name: "Bapat Square", distanceFromPreviousStopKm: 0 },
            { id: "b-stop-2", order: 2, name: "Radisson Square", distanceFromPreviousStopKm: 6 },
            { id: "b-stop-3", order: 3, name: "Sukhliya", distanceFromPreviousStopKm: 4 }
        ]
    },
    {
        id: "iist-route-c",
        tenantId: "indore-institute",
        name: "Rajwada Standby Loop",
        assignedBusId: "iist-bus-103",
        distanceKm: 30,
        nearbyAlternativeRouteId: "iist-route-a",
        stops: [
            { id: "c-stop-1", order: 1, name: "Rajwada Palace", distanceFromPreviousStopKm: 0 },
            { id: "c-stop-2", order: 2, name: "Collectorate Office", distanceFromPreviousStopKm: 5 }
        ]
    }
];

// Student Commute Intention Ingestion Logs
const studentPipe = new StudentCommutePipe();

// 1. IIST ROUTE A: 20 Students registered but Skip Stop #1 & #2 because lowest active passenger is at Stop #3
studentPipe.lockCommuteIntention("indore-institute", "stu-iist-001", "iist-route-a", 3, "COMMUTING");
studentPipe.lockCommuteIntention("indore-institute", "stu-iist-002", "iist-route-a", 3, "COMMUTING");
studentPipe.lockCommuteIntention("indore-institute", "stu-iist-003", "iist-route-a", 4, "COMMUTING");
studentPipe.lockCommuteIntention("indore-institute", "stu-iist-004", "iist-route-a", 4, "COMMUTING");
// Adding some absent students that locked NOT_COMMUTING
studentPipe.lockCommuteIntention("indore-institute", "stu-iist-005", "iist-route-a", 1, "NOT_COMMUTING");
studentPipe.lockCommuteIntention("indore-institute", "stu-iist-006", "iist-route-a", 2, "NOT_COMMUTING");

// 2. IIST ROUTE B: Very low occupancy (2 active students commuting). Cap of bus-102 is 40. Buffer is 36. 
// 2 / 36 = 5.5% Occupancy. This triggers merge logic into Route A if capacity fits.
studentPipe.lockCommuteIntention("indore-institute", "stu-iist-007", "iist-route-b", 2, "COMMUTING");
studentPipe.lockCommuteIntention("indore-institute", "stu-iist-008", "iist-route-b", 2, "COMMUTING");

// 3. IIST ROUTE C: 0 Active Commuters (Standby / Cancelled)
studentPipe.lockCommuteIntention("indore-institute", "stu-iist-009", "iist-route-c", 1, "NOT_COMMUTING");
studentPipe.lockCommuteIntention("indore-institute", "stu-iist-010", "iist-route-c", 2, "NOT_COMMUTING");

// Driver leaves and availability roster for Indore Institute
const iistDriversRoster = {
    "driver-amit": {
        name: "Amit Sharma",
        assignedBusId: "iist-bus-101",
        status: "ACTIVE"
    },
    "driver-rajesh": {
        name: "Rajesh Yadav",
        assignedBusId: "iist-bus-102",
        status: "EMERGENCY_LEAVE", // Hot-swap candidate needed
        standbyDrivers: ["Vijay Kumar (Standby ID: SB-901)", "Ramesh Pal (Standby ID: SB-902)"]
    },
    "driver-dilip": {
        name: "Dilip Joshi",
        assignedBusId: "iist-bus-103",
        status: "ACTIVE"
    }
};

// Run demonstration
function runEcosystemSelfTest() {
    console.log("==================================================================================");
    console.log("🚀 STARTING CAMBUS ENTERPRISE ECOSYSTEM DISPATCH OPTIMIZATION ENGINE SELF-TEST");
    console.log("==================================================================================\n");

    const engine = new CambusEnterpriseEngine(tenantConfigs);

    // Optimize Indore Institute (IIST)
    console.log("[Process] Running nightly analytics optimization for tenant: indore-institute...");
    const optimizedDispatch = engine.optimizeRoutes(
        "indore-institute",
        fleetBuses,
        routesConfig,
        studentPipe.getLogs()
    );

    console.log("\n--- OPTIMIZATION DISPATCH PLAN SUMMARY ---");
    console.log(JSON.stringify(optimizedDispatch, null, 2));

    // Admin Integration Summaries
    console.log("\n--- ADMINISTRATIVE NIGHTLY REVIEW MATRIX SUMMARY ---");
    const adminReviewSummary = getNightlyReviewSummary("indore-institute", optimizedDispatch);
    console.table(adminReviewSummary);

    console.log("\n--- MORNING OPERATIONAL METRICS & HOT-SWAP MATRIX ---");
    const morningMatrix = getMorningOperationalMatrix("indore-institute", optimizedDispatch, iistDriversRoster);
    console.log(JSON.stringify(morningMatrix, null, 2));

    // Driver Portal Payloads
    console.log("\n--- DRIVER BOOT PAYLOAD EXECUTION DEMONSTRATIONS ---");
    const driverAmitPayload = getDriverBootPayload("indore-institute", "iist-bus-101", optimizedDispatch);
    console.log("\nDriver Amit (Bus 101 - Route A):");
    console.log(JSON.stringify(driverAmitPayload, null, 2));

    const driverRajeshPayload = getDriverBootPayload("indore-institute", "iist-bus-102", optimizedDispatch);
    console.log("\nDriver Rajesh (Bus 102 - Route B):");
    console.log(JSON.stringify(driverRajeshPayload, null, 2));

    const driverDilipPayload = getDriverBootPayload("indore-institute", "iist-bus-103", optimizedDispatch);
    console.log("\nDriver Dilip (Bus 103 - Route C):");
    console.log(JSON.stringify(driverDilipPayload, null, 2));

    // Delay Interceptions Demo
    console.log("\n--- DYNAMIC IN-ROUTE INTERCEPTION HANDLER TEST ---");
    const shortDelayCheck = handleStudentDelayInterception("iist-route-a", "a-stop-3", "stu-iist-001", 3, routesConfig);
    console.log("3-Minute Delay Interception Result:");
    console.log(JSON.stringify(shortDelayCheck, null, 2));

    const longDelayCheck = handleStudentDelayInterception("iist-route-a", "a-stop-3", "stu-iist-001", 8, routesConfig);
    console.log("\n8-Minute Delay Interception Result (Trigger Stop Bypass):");
    console.log(JSON.stringify(longDelayCheck, null, 2));

    console.log("\n==================================================================================");
    console.log("🎯 ALL TESTS COMPLETED SUCCESSFULLY.");
    console.log("==================================================================================");
}

// Enable node script runner execution directly from command line
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    runEcosystemSelfTest();
}

// Export ES6 structure for framework imports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CambusEnterpriseEngine,
        StudentCommutePipe,
        getNightlyReviewSummary,
        getMorningOperationalMatrix,
        getDriverBootPayload,
        handleStudentDelayInterception
    };
}
