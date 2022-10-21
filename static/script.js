const statusBox = document.getElementById("status");
const startButton = document.getElementById("start");
const gameArea = document.getElementById("game");

/** @type {WebSocket} */
let socket;
let waiting = false;
let attackWaiting = true;
let turn = false;

startButton.addEventListener("click", (e) => {
	startButton.style.display = "none";
	statusBox.textContent = "loading";

	socket = new WebSocket("ws://localhost:3000");
	socket.addEventListener("message", (ev) => messageHandler(ev))
});

/**
 * @param {MessageEvent<string>} ev
 */
function messageHandler(ev) {
	console.log(ev);
	/** @type {import("../index").ResponseMessage} */
	const message = JSON.parse(ev.data);
	const { status } = message;
	if (status === "error") {
		statusBox.textContent = message.message;
	} else if (status === "waiting_start") {
		statusBox.textContent = "Looking for opponent";
	} else if (status === "match") {
		statusBox.textContent = "Match found. Place your shipis";
		prepareBoard();
	} else if (status === "placed") {
		onPlace(message);
	} else if (status === "attack") {
		onAttack(message);
	} else if (status === "duplicate") {
		statusBox.textContent = "You have already placed a ship here";
		waiting = false;
	} else if (status === "opponent_disconnected") {
		if (statusBox.textContent !== "You have lost")
			statusBox.textContent = "Opponent disconnected";
		startButton.style.display = "initial";
	} else if (status === "start") {
		turn = message.yourTurn;
		attackWaiting = false;
		if (turn) statusBox.textContent = "Your turn";
	}
}

function onPlace(message) {
	waiting = false;
	const { x, y } = message;
	const board = gameArea.getElementsByClassName("game-board")[0];
	board.parentElement.rows[y].cells[x].className = "piece";
}

function onAttack(message) {
	const { x, y, hit, own, end } = message;
	attackWaiting = false;

	const board = gameArea.getElementsByClassName("game-board")[own ? 0 : 1];
	/** @type {DOMTokenList} */
	const classes = board.parentElement.rows[y].cells[x].classList;
	classes.add("hit");
	if (hit) classes.add("piece");

	turn = own;
	statusBox.textContent = turn ? "Your turn" : "Opponent's turn";

	if (end) {
		startButton.style.display = "initial";
		statusBox.textContent = own ? "You have lost" : "You have won!";
		attackWaiting = true;
	}
}

function opponentBoardClick(e) {
	if (!turn) return;
	if (attackWaiting) return;
	const target = e.target;
	if (target.nodeName !== "TD") return;
	if (target.classList.contains("hit")) {
		statusBox.textContent = "You have already clicked here";
		return;
	}
	const x = target.cellIndex;
	const y = target.parentNode.rowIndex;
	socket.send(JSON.stringify({ action: "attack", x, y }));
	attackWaiting = true;
}

function ownBoardClick(e) {
	if (waiting) return;
	const target = e.target;
	if (target.nodeName !== "TD") return;
	const x = target.cellIndex;
	const y = target.parentNode.rowIndex;
	socket.send(JSON.stringify({ action: "place", x, y }));
	waiting = true;
}

function prepareBoard() {
	/** @type {HTMLTemplateElement} */
	const gameTemplate = document.getElementById("gameTemplate");
	/** @type {HTMLTemplateElement} */
	const boardTemplate = document.getElementById("boardTemplate");

	const gameFragment = gameTemplate.content.cloneNode(true);
	const ownBoard = boardTemplate.content.cloneNode(true);
	const opponentBoard = boardTemplate.content.cloneNode(true);

	console.log(gameFragment);
	ownBoard.children[0].addEventListener("click", ownBoardClick);
	opponentBoard.children[0].addEventListener("click", opponentBoardClick);
	gameFragment.children[0].children[1].appendChild(ownBoard);
	gameFragment.children[1].children[1].appendChild(opponentBoard);

	gameArea.replaceChildren(gameFragment);
	waiting = false;
}
