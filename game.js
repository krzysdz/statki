const WIDTH = 10;
const HEIGHT = 10;
const PIECES = 8;

class GamePlayer {
	id;
	map;
	piecesLeft = 0;
	opponent;

	constructor(id) {
		this.id = id;
		this.map = new Map(WIDTH, HEIGHT);
	}
}

export class Game {
	#state = GAME_STATE.PLACING_PIECES;
	#players;

	constructor(p1, p2) {
		const player1 = new GamePlayer(p1);
		const player2 = new GamePlayer(p2);
		// cyclic dependency is not a problem for GC
		player1.opponent = player2;
		player2.opponent = player1;
		this.#players = [player1, player2];
	}

	#boardReady() {
		return this.#players.every(p => p.piecesLeft === PIECES);
	}

	placePiece(id, x, y) {
		if (this.#state !== GAME_STATE.PLACING_PIECES) throw new Error("Placing ships is forbidden");

		const player = this.#players.find(p => p.id === id);
		if (player.piecesLeft >= PIECES) throw new Error("Maximum number of pieces has been placed");

		if (!player.map.placePiece(x, y))
			return "duplicate";

		player.piecesLeft++;

		if (this.#boardReady()) {
			this.#state = GAME_STATE.WAITING_P1;
			return "start";
		}
		return "placed";
	}

	attack(id, x, y) {
		if (this.#state !== GAME_STATE.WAITING_P1 && this.#state !== GAME_STATE.WAITING_P2) throw new Error("Attacking is forbidden");

		const pNum = this.#players.findIndex(p => p.id === id);
		const opponent = this.#players.find(p => p.id !== id);
		if (pNum === 0 && this.#state === GAME_STATE.WAITING_P2 || pNum === 1 && this.#state === GAME_STATE.WAITING_P1)
			throw new Error("Opponents turn");

		const hit = opponent.map.attack(x, y);
		this.#state = pNum ? GAME_STATE.WAITING_P1 : GAME_STATE.WAITING_P2;
		if (hit) {
			if ((--opponent.piecesLeft) === 0) {
				this.#state = GAME_STATE.ENDED;
				return "won";
			}
			return "hit";
		}
		return "miss";
	}

	opponentId(id) {
		return this.#players.find(p => p.id !== id).id;
	}

	get currentPlayer() {
		if (this.#state === GAME_STATE.WAITING_P1) return this.#players[0].id;
		if (this.#state === GAME_STATE.WAITING_P2) return this.#players[1].id;
		return null;
	}
}

const GAME_STATE = /** @type {const} */ ({
	PLACING_PIECES: 0,
	WAITING_P1: 1,
	WAITING_P2: 2,
	ENDED: 3
});

const FIELD_FLAGS = /** @type {const} */ ({
	PIECE: 1,
	HIT: 2
});

class Map {
	#data;
	#height;
	#width;

	/**
	 * @param {number} width
	 * @param {number} height
	 */
	constructor(width, height) {
		if (width <= 0 || height <= 0) throw new Error("Invalid dimensions");
		this.#data = new Int8Array(width * height);
		this.#height = height;
		this.#width = width;
	}

	/**
	 * @param {number} x column
	 * @param {number} y row
	 */
	#toLinear(x, y) {
		return this.#width * y + x;
	}

	placePiece(x, y) {
		const address = this.#toLinear(x, y);
		if (this.#data[address] & FIELD_FLAGS.PIECE) return false;
		this.#data[address] |= FIELD_FLAGS.PIECE;
		return true;
	}

	attack(x, y) {
		const address = this.#toLinear(x, y);
		if (this.#data[address] & FIELD_FLAGS.HIT) throw new Error("This field has already been attacked");
		return ((this.#data[address] |= FIELD_FLAGS.HIT) & FIELD_FLAGS.PIECE) > 0;
	}
}
