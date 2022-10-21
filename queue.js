/** @template T */
class QueueNode {
	/** @type {T} */
	#value;
	/** @type {QueueNode<T> | null} */
	#next = null;

	/** @param {T} value */
	constructor(value) {
		this.#value = value;
	}

	/** @type {QueueNode<T> | null} */
	get next() {
		return this.#next;
	}

	set next(n) {
		this.#next = n;
	}

	/** @returns {T} */
	get value() {
		return this.#value;
	}
}

/** @template T */
export class FIFOQueue {
	/** @type {QueueNode<T> | null} */
	#head = null;
	/** @type {QueueNode<T> | null} */
	#last = null;

	constructor() {}

	empty() {
		return this.#head === null;
	}

	/** @param {T} value */
	push(value) {
		const node = new QueueNode(value);
		if (this.empty()) {
			this.#head = node;
		} else {
			this.#last.next = node;
		}
		this.#last = node;
	}

	take() {
		const val = this.#head.value;
		this.#head = this.#head.next;
		if (this.empty()) this.#last = null;
		return val;
	}

	delete(value) {
		let previous = new QueueNode();
		previous.next = this.#head;

		while (previous.next != null) {
			if (previous.next.value === value) {
				const found = previous.next;
				previous.next = found.next;
				if (found === this.#last) {
					if (previous.next === this.#head) {
						// There was one element in queue
						this.#last = null;
					}
					else {
						this.#last = previous;
					}
				}
				if (found === this.#head) {
					this.#head = found.next;
				}
				break;
			}
			previous = previous.next;
		}
	}
}
