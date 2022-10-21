import express from "express";
import { WebSocketServer } from "ws";
import session from "express-session";
import { FIFOQueue } from "./queue.js";
import { Game } from "./game.js";
import { randomUUID } from "node:crypto"

const PORT = 3000;

const sessionParser = session({
	secret: "5709b28081136b19f42ffbbb01786a13c3ec38ee57b2c128166d75d5efa82b60",
	saveUninitialized: false,
	resave: false
});

/** @typedef {import("ws").WebSocket} WebSocket */

/** @type {{[sessionId: SessionId]: WebSocket}} */
const wsSockets = {};
/** @type {FIFOQueue<SessionId>} */
const playerQueue = new FIFOQueue();
/** @type {{[sessionId: SessionId]: Game}} */
const games = {};

const wss = new WebSocketServer({ noServer: true });
const app = express();

app.use(sessionParser);

app.use("/", (req, res, next) => {
	if (!req.session.sessionId)
		req.session.sessionId = randomUUID();
	next();
})
app.use(express.static("static"));

wss.on("connection", (socket, request) => {
	const { sessionId } = request.session;
	wsSockets[sessionId] = socket;

	if (playerQueue.empty()) {
		playerQueue.push(sessionId);
		socket.send(JSON.stringify({ status: "waiting_start" }));
	} else {
		const opponent = playerQueue.take();
		const game = new Game(opponent, sessionId);
		games[sessionId] = game;
		games[opponent] = game;
		const message = JSON.stringify({ status: "match" });
		socket.send(message);
		wsSockets[opponent].send(message);
	}

	socket.on("message", (message) => {
		const game = games[sessionId];
		if (!game) return;

		try {
			const opponentId = games[sessionId].opponentId(sessionId);
			if (!opponentId) throw new Error("Opponent does not exist");
			const opponentSocket = wsSockets[opponentId];
			/** @type {IncomingMessage} */
			const { action, x, y } = JSON.parse(message);
			if (action === "place") {
				placeHandler(socket, opponentSocket, game, sessionId, x, y);
			} else if (action === "attack") {
				const end = attackHandler(socket, opponentSocket, game, sessionId, x, y);
				if (end) {
					socket.close();
				}
			}
		} catch (error) {
			socket.send(JSON.stringify({ status: "error", message: error.message }));
		}
	});

	socket.on("close", () => {
		playerQueue.delete(sessionId);
		if (sessionId in games) {
			const opponentId = games[sessionId].opponentId(sessionId);
			if (!opponentId) throw new Error("it should be impossible");
			delete games[sessionId];
			delete games[opponentId];
			wsSockets[opponentId].send(JSON.stringify({ status: "opponent_disconnected" }));
			wsSockets[opponentId].close();
		}
		delete wsSockets[sessionId];
	})
});

const server = app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}/`));

server.on("upgrade", (request, socket, head) => {
	sessionParser(request, {}, () => {
		if (!request.session.sessionId) {
			socket.destroy();
			return;
		}
		wss.handleUpgrade(request, socket, head, (ws) => {
			wss.emit('connection', ws, request);
		});
	});
});

/**
 * Handle messages with `"place"` action
 * @param {WebSocket} socket
 * @param {WebSocket} opponentSocket
 * @param {Game} game
 * @param {string} id
 * @param {number} x
 * @param {number} y
 */
function placeHandler(socket, opponentSocket, game, id, x, y) {
	const placeResponse = game.placePiece(id, x, y);
	const gameStart = placeResponse === "start";
	const status = gameStart ? "placed" : placeResponse;
	socket.send(JSON.stringify({ status, x, y }));
	if (gameStart) {
		const firstMove = game.currentPlayer === id;
		socket.send(JSON.stringify({ status: "start", yourTurn: firstMove }));
		opponentSocket.send(JSON.stringify({ status: "start", yourTurn: !firstMove }));
	}
}

/**
 * Handle messages with `"attack"` action
 * @param {WebSocket} socket
 * @param {WebSocket} opponentSocket
 * @param {Game} game
 * @param {string} id
 * @param {number} x
 * @param {number} y
 * @returns {boolean} `true` if the game has ended
 */
function attackHandler(socket, opponentSocket, game, id, x, y) {
	const attackResponse = game.attack(id, x, y);
	const end = attackResponse === "won";
	const hit = attackResponse === "hit" || end;
	/** @type {AttackResponseMessage} */
	const response = { status: "attack", x, y, hit, own: false, end };
	socket.send(JSON.stringify(response));
	opponentSocket.send(JSON.stringify({ ...response, own: true }));
	return end;
}

/** @typedef {string} SessionId */

/**
 * @typedef {object} ErrorMessage
 * @property {"error"} status
 * @property {string} message
 */

/**
 * @typedef {object} StatusMessage
 * @property {"waiting_start" | "opponent_disconnected" | "match"} status
 */

/**
 * @typedef {object} StartMessage
 * @property {"start"} status
 * @property {boolean} yourTurn
 */

/**
 * @typedef {object} PlaceIncomingMessage
 * @property {"place"} action
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {object} PlaceResponseMessage
 * @property {"placed" | "duplicate"} status
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {object} AttackIcomingMessage
 * @property {"attack"} action
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {object} AttackResponseMessage
 * @property {"attack"} status
 * @property {number} x
 * @property {number} y
 * @property {boolean} hit
 * @property {boolean} own `true` if opponent attacked - mark on own board
 * @property {boolean} end
 */

/**
 * @typedef {PlaceIncomingMessage | AttackIcomingMessage} IncomingMessage
 * @typedef {StatusMessage | PlaceResponseMessage | AttackResponseMessage | StartMessage | ErrorMessage} ResponseMessage
 */
