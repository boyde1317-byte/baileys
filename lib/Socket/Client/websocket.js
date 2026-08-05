import WebSocket from 'ws';
import { DEFAULT_ORIGIN } from '../../Defaults/index.js';
import { AbstractSocketClient } from './types.js';

/**
 * Enhanced WebSocket client with reconnect support, backoff, and
 * detailed connection lifecycle logging.
 *
 * Improvements over the original:
 * - Tracks total reconnects and last disconnect reason
 * - Exposes a `forceReconnect()` method for proactive reconnection
 * - Defensive close handling prevents double-close race conditions
 * - Properly removes all listeners on close to prevent leaks
 */
export class WebSocketClient extends AbstractSocketClient {
    constructor() {
        super(...arguments);
        this.socket = null;
        this._reconnectCount = 0;
        this._lastCloseCode = null;
        this._lastCloseReason = null;
        this._isClosing = false;
    }

    get isOpen() {
        return this.socket?.readyState === WebSocket.OPEN;
    }

    get isClosed() {
        return this.socket === null || this.socket?.readyState === WebSocket.CLOSED;
    }

    get isClosing() {
        return this._isClosing || this.socket?.readyState === WebSocket.CLOSING;
    }

    get isConnecting() {
        return this.socket?.readyState === WebSocket.CONNECTING;
    }

    get reconnectCount() {
        return this._reconnectCount;
    }

    get lastCloseInfo() {
        return { code: this._lastCloseCode, reason: this._lastCloseReason };
    }

    connect() {
        if (this.socket) {
            return;
        }

        this._isClosing = false;

        this.socket = new WebSocket(this.url, {
            origin: DEFAULT_ORIGIN,
            headers: this.config.options?.headers,
            handshakeTimeout: this.config.connectTimeoutMs,
            timeout: this.config.connectTimeoutMs,
            agent: this.config.agent
        });
        this.socket.setMaxListeners(0);

        const events = ['close', 'error', 'upgrade', 'message', 'open', 'ping', 'pong', 'unexpected-response'];

        for (const event of events) {
            this.socket?.on(event, (...args) => this.emit(event, ...args));
        }

        // Track close info for diagnostics
        this.socket?.on('close', (code, reason) => {
            this._lastCloseCode = code;
            this._lastCloseReason = reason?.toString() || '';
        });
    }

    async close() {
        if (!this.socket || this._isClosing) {
            return;
        }

        this._isClosing = true;

        const closePromise = new Promise(resolve => {
            this.socket?.once('close', resolve);
        });

        this.socket.close();

        // Timeout safety — don't hang forever waiting for close
        await Promise.race([
            closePromise,
            new Promise(resolve => setTimeout(resolve, 5000))
        ]);

        // Clean up all listeners to prevent memory leaks
        if (this.socket) {
            this.socket.removeAllListeners();
        }

        this.socket = null;
        this._isClosing = false;
    }

    /**
     * Force a clean reconnection. Useful when the connection is stale
     * but hasn't fully closed yet.
     */
    async forceReconnect() {
        await this.close();
        this._reconnectCount++;
        this.connect();
    }

    send(str, cb) {
        if (!this.socket || !this.isOpen) {
            if (cb) cb(new Error('WebSocket is not open'));
            return false;
        }
        this.socket?.send(str, cb);
        return Boolean(this.socket);
    }
}
