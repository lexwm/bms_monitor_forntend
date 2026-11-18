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
        /**
         * Discover original record identities and metadata
         * @description Fixed configured device only. Half-open [from,to), positive interval at most six hours. Includes boot,event,measurement rows, ordered by received_at,boot_id,sequence. Metadata and revision are read in one REPEATABLE READ READ ONLY snapshot. At most5000 rows, overflow422 range_too_dense without partial data. Source record JSON is not loaded.
         */
        get: operations["listTelemetryRecords"];
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
    "/api/v1/battery/history/series": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Bounded history presets with prepared summaries and explicit pending intervals
         * @description One server-time snapshot for both metrics. 10m/1h use bounded raw data; longer ranges use prepared 5-minute/hour/day summaries, with at most two bounded partial five-minute raw edges. 3mo/1y subtract calendar months in Europe/Kyiv with end-of-month clamping. Pending preparation is not a measurement gap. Mean is sample-weighted; min/max preserve peaks. History preparation events use history.updated.v1 on the existing Mercure topic and an independent aggregate_revision.
         */
        get: operations["getHistorySeries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/battery/configuration": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** configurationState */
        get: operations["configurationState"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/battery/configuration/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** createConfigurationRequest */
        post: operations["createConfigurationRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/battery/configuration/requests/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** claimConfigurationRequest */
        post: operations["claimConfigurationRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/battery/configuration/snapshots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** listConfigurationSnapshots */
        get: operations["listConfigurationSnapshots"];
        put?: never;
        /** storeConfigurationSnapshot */
        post: operations["storeConfigurationSnapshot"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/battery/configuration/snapshots/{request_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** getConfigurationSnapshot */
        get: operations["getConfigurationSnapshot"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/battery/history/measurements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Detailed original measurement history with explicit gaps
         * @description Half-open [from,to), positive interval at most six hours, at most5000 measurement rows. Reads revision, measurements and two coverage neighbours in one REPEATABLE READ READ ONLY snapshot. Neighbours affect coverage only and are not returned. Overflow422 range_too_dense; no truncation. Uses the existing gap rules; charts and aggregation are unchanged. Optional frame fragments are type/size checked by SQL before PHP transfer.
         */
        get: operations["getDetailedHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/records/{boot_id}/{sequence}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read one original source record or its bounded decoded projection
         * @description Fixed configured device, exact boot_id+sequence primary key. Default view=raw returns metadata+complete semantic record, preserving unknown properties and numeric digits. PostgreSQL checks the full JSON response is at most1048576 bytes before transferring it to PHP; oversize422 record_too_large, never truncation. view=decoded loads only bounded, type-checked fragments, never entire record/source_record JSON. Read-only AA counters support22/24-byte payloads. Malformed optional capture remains explicit unavailable and does not destroy valid base telemetry.
         */
        get: operations["getTelemetryRecord"];
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
        /** @description Physical numeric output uses at most three fractional decimals. Nonzero values that would round to zero retain their value. Raw stored records and domain calculations are never rounded. */
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
            /**
             * @description Reported current/capacity decoding scale; absent or malformed source extension is null.
             * @enum {number|null}
             */
            current_capacity_unit?: 0.01 | 0.1 | null;
            /** @description Raw BMS software-version byte, not ESP32 firmware. */
            firmware_raw?: number | null;
        };
        LastValid: {
            /** Format: date-time */
            received_at: string;
            battery: components["schemas"]["Battery"];
            jbd?: components["schemas"]["JbdDetails"] | null;
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
            jbd?: components["schemas"]["JbdDetails"] | null;
            /** Format: date-time */
            accepted_at?: string | null;
            uptime_ms?: number | null;
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
            jbd?: components["schemas"]["JbdDetails"] | null;
            /** Format: date-time */
            accepted_at?: string | null;
            uptime_ms?: number | null;
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
            jbd?: components["schemas"]["JbdDetails"] | null;
            /** Format: date-time */
            accepted_at?: string | null;
            uptime_ms?: number | null;
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
        /** @enum {string} */
        HistoryRange: "10m" | "1h" | "12h" | "24h" | "30d" | "3mo" | "1y";
        HistoryMetricSummary: {
            count: number;
            mean: number;
            min: number;
            max: number;
            observed_coverage_seconds: number;
            continuous: boolean;
            /** Format: date-time */
            first_at: string | null;
            /** Format: date-time */
            last_at: string | null;
            first_boot: string | null;
            last_boot: string | null;
        };
        HistoryBin: {
            /** Format: date-time */
            from: string;
            /** Format: date-time */
            to: string;
            /** @enum {string} */
            status: "ready" | "pending";
            observed_coverage_seconds: number | null;
            power_w: components["schemas"]["HistoryMetricSummary"] | null;
            current_a: components["schemas"]["HistoryMetricSummary"] | null;
        };
        RawHistorySeries: {
            /** @constant */
            kind: "raw";
            range: components["schemas"]["HistoryRange"];
            /** Format: date-time */
            from: string;
            /** Format: date-time */
            to: string;
            period_seconds: number;
            source_revision: number;
            aggregate_revision: number;
            /** Format: date-time */
            prepared_at: string | null;
            /** @enum {string} */
            processing_status: "ready" | "pending";
            observed_coverage_seconds: number | null;
            prepared_coverage_seconds: number;
            /** @constant */
            resolution_seconds: 0;
            points: components["schemas"]["HistoryPoint"][];
            gaps: components["schemas"]["Gap"][];
        };
        AggregateHistorySeries: {
            /** @constant */
            kind: "aggregate";
            range: components["schemas"]["HistoryRange"];
            /** Format: date-time */
            from: string;
            /** Format: date-time */
            to: string;
            period_seconds: number;
            source_revision: number;
            aggregate_revision: number;
            /** Format: date-time */
            prepared_at: string | null;
            /** @enum {string} */
            processing_status: "ready" | "pending";
            observed_coverage_seconds: number | null;
            prepared_coverage_seconds: number;
            /** @enum {integer} */
            resolution_seconds: 300 | 3600 | 21600 | 86400;
            bins: components["schemas"]["HistoryBin"][];
        };
        HistorySeries: components["schemas"]["RawHistorySeries"] | components["schemas"]["AggregateHistorySeries"];
        HistoryUpdatedEvent: {
            /** @constant */
            schema: 1;
            aggregate_revision: number;
            /** Format: date-time */
            prepared_at: string;
        };
        JbdField: {
            code: string;
            label_uk: string;
            raw_hex: string;
            value: number | string | boolean | null;
            candidate_value: number | string | boolean | null;
            unit: string | null;
            /** @enum {string} */
            status: "verified" | "candidate" | "unsupported" | "raw" | "invalid";
            source: string;
            address: string | null;
        };
        JbdIssue: {
            code: string;
            message_uk: string;
            slot: string | null;
        };
        JbdDetails: {
            /** @enum {string} */
            data_status: "complete" | "partial" | "unavailable";
            fields: components["schemas"]["JbdField"][];
            issues: components["schemas"]["JbdIssue"][];
        };
        CaptureResult: {
            slot: string;
            /** @enum {string} */
            status: "verified" | "missing" | "timeout" | "error" | "unsupported" | "invalid" | "conflict";
            raw_hex: string | null;
        };
        ConfigurationDecoded: {
            /** @enum {string} */
            data_status: "complete" | "partial" | "unavailable";
            fields: components["schemas"]["JbdField"][];
            slots: components["schemas"]["CaptureResult"][];
            issues: components["schemas"]["JbdIssue"][];
        };
        ProfileSlot: {
            slot: string;
            command: number;
            start_register: number | null;
            register_count: number | null;
        };
        ConfigurationRequest: {
            /** Format: uuid */
            request_id: string;
            request_order: number;
            /** @enum {string} */
            state: "pending" | "running" | "completed" | "expired";
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            deadline_at: string;
            /** Format: date-time */
            claimed_at: string | null;
            /** @constant */
            profile_id: "configuration-v1";
        };
        ConfigurationCapture: {
            slot: string;
            request_hex: string;
            response_hex: string | null;
            /** @enum {string} */
            transport_status: "received" | "timeout" | "error";
            /** Format: date-time */
            received_at: string;
        };
        ConfigurationInput: {
            /** @constant */
            schema: 1;
            /** @constant */
            device_id: "sacred-sun-monitor-01";
            /** Format: uuid */
            request_id: string;
            /** Format: uuid */
            claim_token: string;
            /** Format: date-time */
            capture_started_at: string;
            /** Format: date-time */
            capture_finished_at: string;
            /** Format: date-time */
            received_at: string;
            record: {
                captures: components["schemas"]["ConfigurationCapture"][];
            } & {
                [key: string]: unknown;
            };
        };
        ConfigurationCreate: {
            /** Format: uuid */
            request_id: string;
        };
        ConfigurationClaimInput: {
            /** Format: uuid */
            claim_token: string;
        };
        ConfigurationClaim: {
            request: components["schemas"]["ConfigurationRequest"];
            /** Format: uuid */
            claim_token: string;
            profile: components["schemas"]["ProfileSlot"][];
        };
        ConfigurationReceipt: {
            /** @enum {string} */
            status: "stored" | "duplicate";
            /** Format: uuid */
            request_id: string;
            revision: number;
        };
        ConfigurationUpdatedEvent: {
            configuration_revision: number;
            /** Format: date-time */
            server_time: string;
        };
        ConfigurationSnapshotMetadata: {
            /** Format: uuid */
            request_id: string;
            request_order: number;
            /** Format: date-time */
            capture_started_at: string;
            /** Format: date-time */
            capture_finished_at: string;
            /** Format: date-time */
            received_at: string;
            /** Format: date-time */
            accepted_at: string;
            /** @enum {string} */
            data_status: "complete" | "partial" | "unavailable";
        };
        ConfigurationSnapshot: {
            /** Format: uuid */
            request_id: string;
            request_order: number;
            /** Format: date-time */
            capture_started_at: string;
            /** Format: date-time */
            capture_finished_at: string;
            /** Format: date-time */
            received_at: string;
            /** Format: date-time */
            accepted_at: string;
            /** @enum {string} */
            data_status: "complete" | "partial" | "unavailable";
            decoded: components["schemas"]["ConfigurationDecoded"];
        };
        ConfigurationState: {
            revision: number;
            /** Format: date-time */
            server_time: string;
            request: components["schemas"]["ConfigurationRequest"] | null;
            latest: components["schemas"]["ConfigurationSnapshot"] | null;
            previous_complete: components["schemas"]["ConfigurationSnapshot"] | null;
        };
        ConfigurationSnapshotPage: {
            snapshots: components["schemas"]["ConfigurationSnapshotMetadata"][];
            next_before: string | null;
        };
        RecordMetadata: {
            /** @constant */
            device_id: "sacred-sun-monitor-01";
            boot_id: string;
            sequence: number;
            /** @enum {string} */
            kind: "boot" | "measurement" | "event";
            valid: boolean | null;
            /** Format: date-time */
            received_at: string;
            /** Format: date-time */
            accepted_at: string | null;
            uptime_ms: number | null;
        };
        RecordList: {
            /** Format: date-time */
            from: string;
            /** Format: date-time */
            to: string;
            revision: number;
            records: components["schemas"]["RecordMetadata"][];
        };
        /** @description One original measurement with bounded optional protocol decoding. Original numeric precision is retained in storage. Physical numeric presentation follows Battery; invalid/missing optional frames do not replace a valid battery with zero. */
        DetailedMeasurement: {
            /** Format: date-time */
            received_at: string;
            boot_id: string;
            sequence: number;
            valid: boolean;
            battery: components["schemas"]["Battery"] | null;
            ble_connected: boolean | null;
            /** Format: date-time */
            accepted_at: string | null;
            uptime_ms: number | null;
            jbd: components["schemas"]["JbdDetails"] | null;
        };
        DetailedHistoryResponse: {
            /** Format: date-time */
            from: string;
            /** Format: date-time */
            to: string;
            revision: number;
            points: components["schemas"]["DetailedMeasurement"][];
            gaps: components["schemas"]["Gap"][];
            observed_coverage_seconds: number;
            period_seconds: number;
        };
        /** @description measurement is populated for measurement rows only, including invalid rows. jbd contains a separately supplied record.jbd_capture (for example AA counters), if present. Dynamic 03/04 decoding belongs to measurement.jbd. Unknown record additions are available only through view=raw. */
        DecodedRecord: {
            metadata: components["schemas"]["RecordMetadata"];
            measurement: components["schemas"]["DetailedMeasurement"] | null;
            jbd: components["schemas"]["JbdDetails"] | null;
        };
        /** @description metadata describes the database observation. record is the complete original semantic source JSON, including unknown additions and original numeric digits. Returned directly from PostgreSQL JSON text without PHP decoding or presentation rounding. Original whitespace and property order are not retained. */
        RawRecord: {
            metadata: components["schemas"]["RecordMetadata"];
            record: {
                [key: string]: unknown;
            };
        };
        JbdErrorResponse: {
            error: {
                /** @enum {string} */
                code: "no_measurements_yet" | "invalid_parameters" | "database_unavailable" | "invalid_source_data" | "not_found" | "method_not_allowed" | "internal_error" | "invalid_payload" | "payload_too_large" | "unsupported_media_type" | "record_conflict" | "range_too_dense" | "active_request" | "unknown_request" | "claim_conflict" | "snapshot_conflict" | "record_too_large";
                message: string;
                /**
                 * Format: uuid
                 * @description Existing active configuration request when error.code is active_request.
                 */
                active_request?: string;
            };
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
    listTelemetryRecords: {
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
            /** @description Successful bounded read. Cache-Control: no-store. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordList"];
                };
            };
            /** @description Invalid parameters, range_too_dense, or record_too_large; no partial/truncated response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Database unavailable or malformed stored metadata. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
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
    getHistorySeries: {
        parameters: {
            query: {
                range: components["schemas"]["HistoryRange"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Raw or aggregated history snapshot */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HistorySeries"];
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
    configurationState: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfigurationState"];
                };
            };
            /** @description Invalid transport schema or parameters */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Database unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
        };
    };
    createConfigurationRequest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConfigurationCreate"];
            };
        };
        responses: {
            /** @description Retry of the same intent */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfigurationRequest"];
                };
            };
            /** @description Created after durable commit */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfigurationRequest"];
                };
            };
            /** @description Active request; error.active_request is its UUID */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Body exceeds 65536 bytes */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Use application/json */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Invalid transport schema or parameters */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Database unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
        };
    };
    claimConfigurationRequest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConfigurationClaimInput"];
            };
        };
        responses: {
            /** @description Token stays bound even after terminal state */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfigurationClaim"];
                };
            };
            /** @description No pending request */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Request body exceeds the size limit */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Unsupported media type */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Invalid transport schema or parameters */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Database unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
        };
    };
    listConfigurationSnapshots: {
        parameters: {
            query?: {
                limit?: number;
                before?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfigurationSnapshotPage"];
                };
            };
            /** @description Invalid transport schema or parameters */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Database unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
        };
    };
    storeConfigurationSnapshot: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConfigurationInput"];
            };
        };
        responses: {
            /** @description Semantically identical retry */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfigurationReceipt"];
                };
            };
            /** @description Stored after durable commit */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfigurationReceipt"];
                };
            };
            /** @description Claim mismatch or changed snapshot */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Request body exceeds the size limit */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Unsupported media type */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Invalid transport schema or parameters */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Database unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
        };
    };
    getConfigurationSnapshot: {
        parameters: {
            query?: {
                view?: "raw" | "decoded";
            };
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Decoded by default. raw returns the entire original semantic JSON envelope without presentation rounding. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfigurationSnapshot"] | components["schemas"]["ConfigurationInput"];
                };
            };
            /** @description Configuration snapshot not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Invalid transport schema or parameters */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Database unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
        };
    };
    getDetailedHistory: {
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
            /** @description Successful bounded read. Cache-Control: no-store. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DetailedHistoryResponse"];
                };
            };
            /** @description Invalid parameters, range_too_dense, or record_too_large; no partial/truncated response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Stored data cannot be interpreted safely or database unavailable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
        };
    };
    getTelemetryRecord: {
        parameters: {
            query?: {
                view?: "raw" | "decoded";
            };
            header?: never;
            path: {
                boot_id: string;
                sequence: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful bounded read. Cache-Control: no-store. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RawRecord"] | components["schemas"]["DecodedRecord"];
                };
            };
            /** @description No row with this identity for the configured device. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Invalid parameters, range_too_dense, or record_too_large; no partial/truncated response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
            /** @description Database unavailable or malformed required stored data. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JbdErrorResponse"];
                };
            };
        };
    };
}
