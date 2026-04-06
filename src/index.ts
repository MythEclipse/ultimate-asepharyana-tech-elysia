import cluster from 'node:cluster'
import os from 'node:os'
import process from 'node:process'
import { config } from './config'
import { shutdown, startServer } from './server'
import { systemLogger } from './utils/logger'

/**
 * Enhanced Cluster Entry Point
 * Implements ElysiaJS Production Deployment Patterns
 * https://elysiajs.com/patterns/deploy.html#cluster-mode
 */

const host = process.env.HOST || '0.0.0.0'
const port = config.port

// Only use cluster mode in production or if explicitly enabled
// This prevents orphaned workers when using bun --watch in development
if (config.isProduction && cluster.isPrimary) {
  const numCPUs = os.availableParallelism()
  systemLogger.info(`Primary process ${process.pid} is running`)
  systemLogger.info(`Forking ${numCPUs} workers for multi-thread support...`)

  systemLogger.info(`🦊 Elysia is starting at ${host}:${port}`)
  systemLogger.info(`📝 Environment: ${config.env}`)
  systemLogger.info(`🔐 Auth endpoints: http://${host}:${port}/api/auth`)
  systemLogger.info(`📚 Swagger docs: http://${host}:${port}/docs`)

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  // Handle worker exit and restart (Basic self-healing)
  cluster.on('exit', (worker, code, signal) => {
    // Only restart if not shutting down
    if (cluster.isPrimary && !process.env.STOPPING) {
      systemLogger.warn(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}. Starting a new worker...`)
      cluster.fork()
    }
  })

  // Master graceful shutdown
  const handleMasterShutdown = async (signal: string) => {
    systemLogger.info(`${signal} received on Primary. Shutting down all workers...`)
    process.env.STOPPING = 'true'

    if (cluster.workers) {
      for (const id in cluster.workers) {
        const worker = cluster.workers[id]
        if (worker) {
          worker.kill(signal)
          // Force kill if not dead in 2 seconds
          setTimeout(() => {
            if (worker.process.pid) {
              try {
                process.kill(worker.process.pid, 'SIGKILL')
              }
              catch {
                // Process already dead
              }
            }
          }, 2000)
        }
      }
    }
    process.exit(0)
  }

  process.on('SIGINT', () => handleMasterShutdown('SIGINT'))
  process.on('SIGTERM', () => handleMasterShutdown('SIGTERM'))
}
else if (!config.isProduction) {
  // Simple single-thread execution for development
  systemLogger.info(`Starting in development mode (single-threaded)`)
  systemLogger.info(`🦊 Elysia is starting at ${host}:${port}`)
  systemLogger.info(`📝 Environment: ${config.env}`)
  systemLogger.info(`🔐 Auth endpoints: http://${host}:${port}/api/auth`)
  systemLogger.info(`📚 Swagger docs: http://${host}:${port}/docs`)

  startServer().catch((error) => {
    systemLogger.error(`Failed to start server`, error)
    process.exit(1)
  })
}
else {
  // Worker process
  systemLogger.info(`Worker ${process.pid} is online`)

  // Start the server instance in each worker
  startServer().catch((error) => {
    systemLogger.error(`Failed to start server in worker ${process.pid}`, error)
    process.exit(1)
  })

  const handleWorkerShutdown = async (signal: string) => {
    systemLogger.info(`${signal} received on worker ${process.pid}. Shutting down gracefully...`)
    try {
      await shutdown()
      process.exit(0)
    }
    catch {
      process.exit(1)
    }
  }

  process.on('SIGINT', () => handleWorkerShutdown('SIGINT'))
  process.on('SIGTERM', () => handleWorkerShutdown('SIGTERM'))
}
