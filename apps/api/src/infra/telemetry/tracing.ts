/**
 * OpenTelemetry bootstrap. Must be imported before any other module in
 * main.ts so the HTTP instrumentation can patch node:http first.
 *
 * No-op unless OTEL_EXPORTER_OTLP_ENDPOINT is set (read directly from
 * process.env — this runs before the zod-validated env is available).
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

let sdk: NodeSDK | null = null;

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  sdk = new NodeSDK({
    serviceName: 'medqueue-api',
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) =>
          req.url === '/health' || req.url === '/health/ready' || req.url === '/metrics',
      }),
    ],
  });
  sdk.start();

  process.on('SIGTERM', () => {
    void sdk?.shutdown();
  });
}

export { sdk };
