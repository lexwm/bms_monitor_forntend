export interface paths {
    "/api/v1/battery/latest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the latest measurement
         * @description No query parameters. Latest measurement includes invalid records; it never silently falls back to last_valid. Stale when age > 20 seconds. No cache.
         */
        get: operations["getLatestBattery"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/records": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Persist one source record; no collector implementation
         * @description Maximum 65536 bytes, JSON depth32. Source received_at is immutable, <=6 fractional digits and not future. Same identity and content returns200, conflict409. Only acknowledged after commit. Record object retained as semantic JSON.
         */
        post: operations["ingestRecord"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Coherent snapshot for stream bootstrap or recovery */
        get: operations["getStreamState"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/battery/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Bounded raw history with explicit missing-data intervals
         * @description UTC half-open interval, maximum6 hours, 5000 in-range measurements. Excess density422. Boundary neighbours support gap calculation, not returned as points. Coverage is observation coverage, not power availability or energy.
         */
        get: operations["getHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Battery: {
            voltage_v: number | null;
            /** @description Signed battery current in amperes: positive means charging, negative means discharging, exactly zero means no charging or discharging. Null means unavailable. */
            current_a: number | null;
            power_w: number | null;
            soc_percent: number | null;
            remaining_ah: number | null;
            reported_capacity_ah: number | null;
            cell_min_v: number | null;
            cell_max_v: number | null;
            cell_delta_mv: number | null;
            cells_v: number[] | null;
            temperatures_c: number[] | null;
            charge_mos_on: boolean | null;
            discharge_mos_on: boolean | null;
            protection_flags: number | null;
            cycles: number | null;
        };
        LastValid: {
            /** Format: date-time */
            received_at: string;
            battery: components["schemas"]["Battery"];
        };
        FreshLatest: {
            /** @constant */
            device_id: "sacred-sun-monitor-01";
            boot_id: string;
            sequence: number;
            /** Format: date-time */
            received_at: string;
            measured_at: null;
            /** @constant */
            time_quality: "reception_only";
            /** Format: date-time */
            server_time: string;
            age_seconds: number;
            /** @enum {string} */
            data_source: "synthetic" | "device";
            ble_connected: boolean | null;
            last_valid: components["schemas"]["LastValid"] | null;
            /** @constant */
            state: "fresh";
            /** @constant */
            valid: true;
            /** @constant */
            stale: false;
            /**
             * @description For fresh valid measurements: charge when current_a > 0, discharge when current_a < 0, idle only when current_a = 0, unknown when current_a is unavailable. No deadband. The installation owner defines idle as mains / no charging; there is no independent mains-presence signal.
             * @enum {string}
             */
            mode: "charge" | "discharge" | "idle" | "unknown";
            battery: components["schemas"]["Battery"];
            reason: null;
            revision: number;
        };
        StaleLatest: {
            /** @constant */
            device_id: "sacred-sun-monitor-01";
            boot_id: string;
            sequence: number;
            /** Format: date-time */
            received_at: string;
            measured_at: null;
            /** @constant */
            time_quality: "reception_only";
            /** Format: date-time */
            server_time: string;
            age_seconds: number;
            /** @enum {string} */
            data_source: "synthetic" | "device";
            ble_connected: boolean | null;
            last_valid: components["schemas"]["LastValid"] | null;
            /** @constant */
            state: "stale";
            /** @constant */
            valid: true;
            /** @constant */
            stale: true;
            /** @constant */
            mode: "unknown";
            battery: components["schemas"]["Battery"];
            /** @constant */
            reason: "data_stale";
            revision: number;
        };
        InvalidLatest: {
            /** @constant */
            device_id: "sacred-sun-monitor-01";
            boot_id: string;
            sequence: number;
            /** Format: date-time */
            received_at: string;
            measured_at: null;
            /** @constant */
            time_quality: "reception_only";
            /** Format: date-time */
            server_time: string;
            age_seconds: number;
            /** @enum {string} */
            data_source: "synthetic" | "device";
            ble_connected: boolean | null;
            last_valid: components["schemas"]["LastValid"] | null;
            /** @constant */
            state: "invalid";
            /** @constant */
            valid: false;
            stale: boolean;
            /** @constant */
            mode: "unknown";
            battery: null;
            /** @constant */
            reason: "invalid_measurement";
            revision: number;
        };
        LatestResponse: components["schemas"]["FreshLatest"] | components["schemas"]["StaleLatest"] | components["schemas"]["InvalidLatest"];
        ErrorResponse: {
            error: {
                /** @enum {string} */
                code: "no_measurements_yet" | "invalid_parameters" | "database_unavailable" | "invalid_source_data" | "not_found" | "method_not_allowed" | "internal_error" | "invalid_payload" | "payload_too_large" | "unsupported_media_type" | "record_conflict" | "range_too_dense";
                message: string;
            };
        };
        IngestBattery: {
            voltage_v: number | null;
            /** @description Signed battery current in amperes: positive means charging, negative means discharging, exactly zero means no charging or discharging. Null means unavailable. */
            current_a: number | null;
            power_w: number | null;
            soc_percent: number | null;
            remaining_ah: number | null;
            reported_capacity_ah: number | null;
            cell_min_v: number | null;
            cell_max_v: number | null;
            cell_delta_mv: number | null;
            cells_v: number[] | null;
            temperatures_c: number[] | null;
            charge_mos_on: boolean | null;
            discharge_mos_on: boolean | null;
            protection_flags: number | null;
            cycles: number | null;
        };
        IngestRecord: {
            /** @constant */
            schema: 1;
            /** @constant */
            device_id: "sacred-sun-monitor-01";
            boot_id: string;
            sequence: number;
            uptime_ms: number;
            /** Format: date-time */
            received_at: string;
            /** @enum {string} */
            kind: "measurement" | "boot" | "event";
            valid: boolean | null;
            record: Record<string, never>;
        } & (unknown & unknown & unknown);
        Receipt: {
            /** @enum {string} */
            status: "stored" | "duplicate";
            revision: number;
            /** @constant */
            device_id: "sacred-sun-monitor-01";
            boot_id: string;
            sequence: number;
        };
        StreamState: {
            /** @constant */
            schema: 1;
            revision: number;
            /** Format: date-time */
            server_time: string;
            latest: components["schemas"]["LatestResponse"] | null;
            /** @constant */
            topic: "urn:bms:battery:sacred-sun-monitor-01";
            /** @constant */
            hub_url: "/.well-known/mercure";
        };
        TelemetryEvent: {
            /** @constant */
            schema: 1;
            revision: number;
            /** Format: date-time */
            server_time: string;
            latest: components["schemas"]["LatestResponse"] | null;
            /** @constant */
            history_changed: true;
        };
        HistoryPoint: {
            /** Format: date-time */
            received_at: string;
            boot_id: string;
            sequence: number;
            valid: boolean;
            /** @description Signed battery current in amperes: positive means charging, negative means discharging, exactly zero means no charging or discharging. Null means unavailable. */
            current_a: number | null;
            power_w: number | null;
            soc_percent: number | null;
        };
        Gap: {
            /** Format: date-time */
            from: string;
            /** Format: date-time */
            to: string;
        };
        HistoryResponse: {
            /** Format: date-time */
            from: string;
            /** Format: date-time */
            to: string;
            revision: number;
            points: components["schemas"]["HistoryPoint"][];
            gaps: components["schemas"]["Gap"][];
            observed_coverage_seconds: number;
            period_seconds: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getLatestBattery: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Latest measurement, including stale or invalid. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LatestResponse"];
                };
            };
            /** @description No measurements or unknown resource. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Method not allowed. */
            405: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unknown query parameters are rejected. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unexpected server failure. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Database or source data unavailable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ingestRecord: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IngestRecord"];
            };
        };
        responses: {
            /** @description HTTP 200: successful result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Receipt"];
                };
            };
            /** @description HTTP 201: successful result */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Receipt"];
                };
            };
            /** @description HTTP 400: documented error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description HTTP 409: documented error */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description HTTP 413: documented error */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description HTTP 415: documented error */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description HTTP 422: documented error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description HTTP 500: documented error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description HTTP 503: documented error */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getStreamState: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description HTTP 200: successful result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StreamState"];
                };
            };
            /** @description HTTP 422: documented error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description HTTP 500: documented error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description HTTP 503: documented error */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getHistory: {
        parameters: {
            query: {
                from: string;
                to: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description HTTP 200: successful result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HistoryResponse"];
                };
            };
            /** @description HTTP 422: documented error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description HTTP 500: documented error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description HTTP 503: documented error */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
}
