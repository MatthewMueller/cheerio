/**
 * Methods for traversing the DOM structure.
 *
 * @module cheerio/traversing
 */

import { Node, Element, hasChildren, isDocument } from 'domhandler';
import type { Cheerio } from '../cheerio';
import * as select from 'cheerio-select';
import { domEach, isTag, isCheerio } from '../utils';
import { contains } from '../static';
import { DomUtils } from 'htmlparser2';
import type { FilterFunction, AcceptedFilters } from '../types';
const { uniqueSort } = DomUtils;
const reSiblingSelector = /^\s*[~+]/;

/**
 * Get the descendants of each element in the current set of matched elements,
 * filtered by a selector, jQuery object, or element.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('#fruits').find('li').length;
 * //=> 3
 * $('#fruits').find($('.apple')).length;
 * //=> 1
 * ```
 *
 * @param selectorOrHaystack - Element to look for.
 * @returns The found elements.
 * @see {@link https://api.jquery.com/find/}
 */
export function find<T extends Node>(
  this: Cheerio<T>,
  selectorOrHaystack?: string | Cheerio<Element> | Element
): Cheerio<Element> {
  if (!selectorOrHaystack) {
    return this._make([]);
  }

  const context: Node[] = this.toArray();

  if (typeof selectorOrHaystack !== 'string') {
    const haystack = isCheerio(selectorOrHaystack)
      ? selectorOrHaystack.toArray()
      : [selectorOrHaystack];

    return this._make(
      haystack.filter((elem) => context.some((node) => contains(node, elem)))
    );
  }

  const elems = reSiblingSelector.test(selectorOrHaystack)
    ? context
    : context.reduce<Node[]>(
        (newElems, elem) =>
          hasChildren(elem)
            ? newElems.concat(elem.children.filter(isTag))
            : newElems,
        []
      );

  const options = { context, xmlMode: this.options.xmlMode };

  return this._make(select.select(selectorOrHaystack, elems, options));
}

/**
 * Matcher provides function, what finds elements based on function provided. It
 * also houses filtering. What may provided later when function is called.
 *
 * @private
 * @param fn - Function for collecting elements.
 * @returns - Wrapped function.
 */
function _matcher(
  fn: (elem: Node) => Element | Element[] | null,
  ...postFns: ((elems: Element[]) => Element[])[]
) {
  // Customized Map, discards null elements
  function matchMap(elems: Cheerio<Node>): Element[] {
    const ret: (Element[] | Element)[] = [];

    for (let i = 0; i < elems.length; i++) {
      const value = fn(elems[i]);
      if (value !== null) {
        ret.push(value);
      }
    }
    return new Array<Element>().concat(...ret);
  }

  return function <T extends Node>(
    this: Cheerio<T>,
    selector?: AcceptedFilters<T>
  ): Cheerio<Element> {
    let matched: Element[] = matchMap(this);

    // Select.filter uses uniqueSort already internally
    if (selector) {
      matched = filter.call(matched, selector, this).toArray();
    }

    return this._make(
      this.length > 1
        ? // Post processing is only necessary if there is more than one element.
          postFns.reduce((elems, fn) => fn(elems), matched)
        : matched
    );
  };
}

function _matchUntil(
  allElems: ReturnType<typeof _matcher>,
  nextElem: (elem: Node) => Element | null,
  ...postFns: ((elems: Element[]) => Element[])[]
) {
  return function <T extends Node>(
    this: Cheerio<T>,
    selector?: AcceptedFilters<Node> | null,
    filterSelector?: AcceptedFilters<T>
  ): Cheerio<Element> {
    if (!selector) return allElems.call(this, filterSelector as any);
    const matches = getFilterFn(
      typeof selector === 'string' ? allElems.call(this, selector) : selector
    );

    let matched: Element[] = [];

    domEach(this, (elem) => {
      for (;;) {
        const next = nextElem(elem);

        if (!next) break;

        if (isTag(next)) {
          // FIXME: `matched` might contain duplicates here
          if (matches(next, matched.length)) break;
          matched.push(next);
        }

        elem = next;
      }
    });

    // Select.filter uses uniqueSort already internally
    if (filterSelector) {
      matched = filter.call(matched, filterSelector, this).toArray();
    }

    return this._make(
      this.length > 1
        ? // Post processing is only necessary if there is more than one element.
          postFns.reduce((elems, fn) => fn(elems), matched)
        : matched
    );
  };
}

function _removeDuplicates<T extends Node>(elems: T[]): T[] {
  return Array.from(new Set<T>(elems));
}

/**
 * Get the parent of each element in the current set of matched elements,
 * optionally filtered by a selector.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.pear').parent().attr('id');
 * //=> fruits
 * ```
 *
 * @param selector - If specified filter for parent.
 * @returns The parents.
 * @see {@link https://api.jquery.com/parent/}
 */
export const parent = _matcher(
  ({ parent }) => (parent && !isDocument(parent) ? (parent as Element) : null),
  _removeDuplicates
);

/**
 * Get a set of parents filtered by `selector` of each element in the current
 * set of match elements.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.orange').parents().length;
 * //=> 2
 * $('.orange').parents('#fruits').length;
 * //=> 1
 * ```
 *
 * @param selector - If specified filter for parents.
 * @returns The parents.
 * @see {@link https://api.jquery.com/parents/}
 */
export const parents = _matcher(
  (elem) => {
    const matched = [];
    while (elem.parent && !isDocument(elem.parent)) {
      matched.push(elem.parent as Element);
      elem = elem.parent;
    }
    return matched;
  },
  uniqueSort,
  (elems) => elems.reverse()
);

/**
 * Get the ancestors of each element in the current set of matched elements, up
 * to but not including the element matched by the selector, DOM node, or cheerio object.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.orange').parentsUntil('#food').length;
 * //=> 1
 * ```
 *
 * @param selector - Selector for element to stop at.
 * @param filterSelector - Optional filter for parents.
 * @returns The parents.
 * @see {@link https://api.jquery.com/parentsUntil/}
 */
export const parentsUntil = _matchUntil(
  parents,
  ({ parent }) => (parent && !isDocument(parent) ? (parent as Element) : null),
  uniqueSort,
  (elems) => elems.reverse()
);

/**
 * For each element in the set, get the first element that matches the selector
 * by testing the element itself and traversing up through its ancestors in the DOM tree.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.orange').closest();
 * //=> []
 *
 * $('.orange').closest('.apple');
 * // => []
 *
 * $('.orange').closest('li');
 * //=> [<li class="orange">Orange</li>]
 *
 * $('.orange').closest('#fruits');
 * //=> [<ul id="fruits"> ... </ul>]
 * ```
 *
 * @param selector - Selector for the element to find.
 * @returns The closest nodes.
 * @see {@link https://api.jquery.com/closest/}
 */
export function closest<T extends Node>(
  this: Cheerio<T>,
  selector?: AcceptedFilters<T>
): Cheerio<Node> {
  const set: Node[] = [];

  if (!selector) {
    return this._make(set);
  }

  domEach(this, (elem: Node | null) => {
    while (elem && elem.type !== 'root') {
      if (!selector || filter.call([elem], selector, this).length) {
        // Do not add duplicate elements to the set
        if (elem && !set.includes(elem)) {
          set.push(elem);
        }
        break;
      }
      elem = elem.parent;
    }
  });

  return this._make(set);
}

/**
 * Gets the next sibling of the first selected element, optionally filtered by a selector.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.apple').next().hasClass('orange');
 * //=> true
 * ```
 *
 * @param selector - If specified filter for sibling.
 * @returns The next nodes.
 * @see {@link https://api.jquery.com/next/}
 */
export const next = _matcher((elem) => DomUtils.nextElementSibling(elem));

/**
 * Gets all the following siblings of the first selected element, optionally
 * filtered by a selector.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.apple').nextAll();
 * //=> [<li class="orange">Orange</li>, <li class="pear">Pear</li>]
 * $('.apple').nextAll('.orange');
 * //=> [<li class="orange">Orange</li>]
 * ```
 *
 * @param selector - If specified filter for siblings.
 * @returns The next nodes.
 * @see {@link https://api.jquery.com/nextAll/}
 */
export const nextAll = _matcher((elem) => {
  const matched = [];
  while (elem.next) {
    if (isTag(elem.next)) matched.push(elem.next);
    elem = elem.next;
  }
  return matched;
}, _removeDuplicates);

/**
 * Gets all the following siblings up to but not including the element matched
 * by the selector, optionally filtered by another selector.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.apple').nextUntil('.pear');
 * //=> [<li class="orange">Orange</li>]
 * ```
 *
 * @param selector - Selector for element to stop at.
 * @param filterSelector - If specified filter for siblings.
 * @returns The next nodes.
 * @see {@link https://api.jquery.com/nextUntil/}
 */
export const nextUntil = _matchUntil(
  nextAll,
  (el) => DomUtils.nextElementSibling(el),
  _removeDuplicates
);

/**
 * Gets the previous sibling of the first selected element optionally filtered
 * by a selector.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.orange').prev().hasClass('apple');
 * //=> true
 * ```
 *
 * @param selector - If specified filter for siblings.
 * @returns The previous nodes.
 * @see {@link https://api.jquery.com/prev/}
 */
export const prev = _matcher((elem) => DomUtils.prevElementSibling(elem));

/**
 * Gets all the preceding siblings of the first selected element, optionally
 * filtered by a selector.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.pear').prevAll();
 * //=> [<li class="orange">Orange</li>, <li class="apple">Apple</li>]
 *
 * $('.pear').prevAll('.orange');
 * //=> [<li class="orange">Orange</li>]
 * ```
 *
 * @param selector - If specified filter for siblings.
 * @returns The previous nodes.
 * @see {@link https://api.jquery.com/prevAll/}
 */
export const prevAll = _matcher((elem) => {
  const matched = [];
  while (elem.prev) {
    if (isTag(elem.prev)) matched.push(elem.prev);
    elem = elem.prev;
  }
  return matched;
}, _removeDuplicates);

/**
 * Gets all the preceding siblings up to but not including the element matched
 * by the selector, optionally filtered by another selector.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.pear').prevUntil('.apple');
 * //=> [<li class="orange">Orange</li>]
 * ```
 *
 * @param selector - Selector for element to stop at.
 * @param filterSelector - If specified filter for siblings.
 * @returns The previous nodes.
 * @see {@link https://api.jquery.com/prevUntil/}
 */
export const prevUntil = _matchUntil(
  prevAll,
  (el) => DomUtils.prevElementSibling(el),
  _removeDuplicates
);

/**
 * Get the siblings of each element (excluding the element) in the set of
 * matched elements, optionally filtered by a selector.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.pear').siblings().length;
 * //=> 2
 *
 * $('.pear').siblings('.orange').length;
 * //=> 1
 * ```
 *
 * @param selector - If specified filter for siblings.
 * @returns The siblings.
 * @see {@link https://api.jquery.com/siblings/}
 */
export const siblings = _matcher(
  (elem) =>
    DomUtils.getSiblings(elem).filter(
      (el): el is Element => isTag(el) && el !== elem
    ),
  uniqueSort
);

/**
 * Gets the children of the first selected element.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('#fruits').children().length;
 * //=> 3
 *
 * $('#fruits').children('.pear').text();
 * //=> Pear
 * ```
 *
 * @param selector - If specified filter for children.
 * @returns The children.
 * @see {@link https://api.jquery.com/children/}
 */
export const children = _matcher(
  (elem) => DomUtils.getChildren(elem).filter(isTag),
  _removeDuplicates
);

/**
 * Gets the children of each element in the set of matched elements, including
 * text and comment nodes.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('#fruits').contents().length;
 * //=> 3
 * ```
 *
 * @returns The children.
 * @see {@link https://api.jquery.com/contents/}
 */
export function contents<T extends Node>(this: Cheerio<T>): Cheerio<Node> {
  const elems = this.toArray().reduce<Node[]>(
    (newElems, elem) =>
      hasChildren(elem) ? newElems.concat(elem.children) : newElems,
    []
  );
  return this._make(elems);
}

/**
 * Iterates over a cheerio object, executing a function for each matched
 * element. When the callback is fired, the function is fired in the context of
 * the DOM element, so `this` refers to the current element, which is equivalent
 * to the function parameter `element`. To break out of the `each` loop early,
 * return with `false`.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * const fruits = [];
 *
 * $('li').each(function (i, elem) {
 *   fruits[i] = $(this).text();
 * });
 *
 * fruits.join(', ');
 * //=> Apple, Orange, Pear
 * ```
 *
 * @param fn - Function to execute.
 * @returns The instance itself, useful for chaining.
 * @see {@link https://api.jquery.com/each/}
 */
export function each<T>(
  this: Cheerio<T>,
  fn: (this: T, i: number, el: T) => void | boolean
): Cheerio<T> {
  let i = 0;
  const len = this.length;
  while (i < len && fn.call(this[i], i, this[i]) !== false) ++i;
  return this;
}

/**
 * Pass each element in the current matched set through a function, producing a
 * new Cheerio object containing the return values. The function can return an
 * individual data item or an array of data items to be inserted into the
 * resulting set. If an array is returned, the elements inside the array are
 * inserted into the set. If the function returns null or undefined, no element
 * will be inserted.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('li')
 *   .map(function (i, el) {
 *     // this === el
 *     return $(this).text();
 *   })
 *   .toArray()
 *   .join(' ');
 * //=> "apple orange pear"
 * ```
 *
 * @param fn - Function to execute.
 * @returns The mapped elements, wrapped in a Cheerio collection.
 * @see {@link https://api.jquery.com/map/}
 */
export function map<T, M>(
  this: Cheerio<T>,
  fn: (this: T, i: number, el: T) => M[] | M | null | undefined
): Cheerio<M> {
  let elems: M[] = [];
  for (let i = 0; i < this.length; i++) {
    const el = this[i];
    const val = fn.call(el, i, el);
    if (val != null) {
      elems = elems.concat(val);
    }
  }
  return this._make(elems);
}

function getFilterFn<T>(
  match: FilterFunction<T> | Cheerio<T> | T
): (el: T, i: number) => boolean {
  if (typeof match === 'function') {
    return function (el, i) {
      return (match as FilterFunction<T>).call(el, i, el);
    };
  }
  if (isCheerio<T>(match)) {
    return (el) => Array.prototype.includes.call(match, el);
  }
  return function (el) {
    return match === el;
  };
}

/**
 * Iterates over a cheerio object, reducing the set of selector elements to
 * those that match the selector or pass the function's test.
 *
 * This is the definition for using type guards; have a look below for other
 * ways to invoke this method. The function is executed in the context of the
 * selected element, so `this` refers to the current element.
 *
 * @category Traversing
 * @example <caption>Function</caption>
 *
 * ```js
 * $('li')
 *   .filter(function (i, el) {
 *     // this === el
 *     return $(this).attr('class') === 'orange';
 *   })
 *   .attr('class'); //=> orange
 * ```
 *
 * @param match - Value to look for, following the rules above.
 * @returns The filtered collection.
 * @see {@link https://api.jquery.com/filter/}
 */
export function filter<T, S extends T>(
  this: Cheerio<T>,
  match: (this: T, index: number, value: T) => value is S
): Cheerio<S>;
/**
 * Iterates over a cheerio object, reducing the set of selector elements to
 * those that match the selector or pass the function's test.
 *
 * - When a Cheerio selection is specified, return only the elements contained in
 *   that selection.
 * - When an element is specified, return only that element (if it is contained in
 *   the original selection).
 * - If using the function method, the function is executed in the context of the
 *   selected element, so `this` refers to the current element.
 *
 * @category Traversing
 * @example <caption>Selector</caption>
 *
 * ```js
 * $('li').filter('.orange').attr('class');
 * //=> orange
 * ```
 *
 * @example <caption>Function</caption>
 *
 * ```js
 * $('li')
 *   .filter(function (i, el) {
 *     // this === el
 *     return $(this).attr('class') === 'orange';
 *   })
 *   .attr('class'); //=> orange
 * ```
 *
 * @param match - Value to look for, following the rules above. See
 *   {@link AcceptedFilters}.
 * @returns The filtered collection.
 * @see {@link https://api.jquery.com/filter/}
 */
export function filter<T, S extends AcceptedFilters<T>>(
  this: Cheerio<T>,
  match: S
): Cheerio<S extends string ? Element : T>;
/**
 * Internal `filter` variant used by other functions to filter their elements.
 *
 * @private
 * @param match - Value to look for, following the rules above.
 * @param container - The container that is used to create the resulting Cheerio instance.
 * @returns The filtered collection.
 * @see {@link https://api.jquery.com/filter/}
 */
export function filter<T>(
  this: T[],
  match: AcceptedFilters<T>,
  container: Cheerio<Node>
): Cheerio<Element>;
export function filter<T>(
  this: Cheerio<T> | T[],
  match: AcceptedFilters<T>,
  container = this
): Cheerio<unknown> {
  if (!isCheerio(container)) {
    throw new Error('Not able to create a Cheerio instance.');
  }

  const nodes = isCheerio(this) ? this.toArray() : this;

  const result =
    typeof match === 'string'
      ? select.filter(
          match,
          (nodes as unknown as Node[]).filter(isTag),
          container.options
        )
      : nodes.filter(getFilterFn(match));

  return container._make<unknown>(result);
}

/**
 * Remove elements from the set of matched elements. Given a Cheerio object that
 * represents a set of DOM elements, the `.not()` method constructs a new
 * Cheerio object from a subset of the matching elements. The supplied selector
 * is tested against each element; the elements that don't match the selector
 * will be included in the result.
 *
 * The `.not()` method can take a function as its argument in the same way that
 * `.filter()` does. Elements for which the function returns `true` are excluded
 * from the filtered set; all other elements are included.
 *
 * @category Traversing
 * @example <caption>Selector</caption>
 *
 * ```js
 * $('li').not('.apple').length;
 * //=> 2
 * ```
 *
 * @example <caption>Function</caption>
 *
 * ```js
 * $('li').not(function (i, el) {
 *   // this === el
 *   return $(this).attr('class') === 'orange';
 * }).length; //=> 2
 * ```
 *
 * @param match - Value to look for, following the rules above.
 * @param container - Optional node to filter instead.
 * @returns The filtered collection.
 * @see {@link https://api.jquery.com/not/}
 */
export function not<T extends Node>(
  this: Cheerio<T> | T[],
  match: AcceptedFilters<T>,
  container = this
): Cheerio<T> {
  if (!isCheerio(container)) {
    throw new Error('Not able to create a Cheerio instance.');
  }

  let nodes = isCheerio(this) ? this.toArray() : this;

  if (typeof match === 'string') {
    const elements = (nodes as Node[]).filter(isTag);
    const matches = new Set<Node>(
      select.filter(match, elements, container.options)
    );
    nodes = nodes.filter((el) => !matches.has(el));
  } else {
    const filterFn = getFilterFn(match);
    nodes = nodes.filter((el, i) => !filterFn(el, i));
  }

  return container._make(nodes);
}

/**
 * Filters the set of matched elements to only those which have the given DOM
 * element as a descendant or which have a descendant that matches the given
 * selector. Equivalent to `.filter(':has(selector)')`.
 *
 * @category Traversing
 * @example <caption>Selector</caption>
 *
 * ```js
 * $('ul').has('.pear').attr('id');
 * //=> fruits
 * ```
 *
 * @example <caption>Element</caption>
 *
 * ```js
 * $('ul').has($('.pear')[0]).attr('id');
 * //=> fruits
 * ```
 *
 * @param selectorOrHaystack - Element to look for.
 * @returns The filtered collection.
 * @see {@link https://api.jquery.com/has/}
 */
export function has(
  this: Cheerio<Node | Element>,
  selectorOrHaystack: string | Cheerio<Element> | Element
): Cheerio<Node | Element> {
  return this.filter(
    typeof selectorOrHaystack === 'string'
      ? // Using the `:has` selector here short-circuits searches.
        `:has(${selectorOrHaystack})`
      : (_, el) => this._make(el).find(selectorOrHaystack).length > 0
  );
}

/**
 * Will select the first element of a cheerio object.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('#fruits').children().first().text();
 * //=> Apple
 * ```
 *
 * @returns The first element.
 * @see {@link https://api.jquery.com/first/}
 */
export function first<T extends Node>(this: Cheerio<T>): Cheerio<T> {
  return this.length > 1 ? this._make(this[0]) : this;
}

/**
 * Will select the last element of a cheerio object.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('#fruits').children().last().text();
 * //=> Pear
 * ```
 *
 * @returns The last element.
 * @see {@link https://api.jquery.com/last/}
 */
export function last<T>(this: Cheerio<T>): Cheerio<T> {
  return this.length > 0 ? this._make(this[this.length - 1]) : this;
}

/**
 * Reduce the set of matched elements to the one at the specified index. Use
 * `.eq(-i)` to count backwards from the last selected element.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('li').eq(0).text();
 * //=> Apple
 *
 * $('li').eq(-1).text();
 * //=> Pear
 * ```
 *
 * @param i - Index of the element to select.
 * @returns The element at the `i`th position.
 * @see {@link https://api.jquery.com/eq/}
 */
export function eq<T>(this: Cheerio<T>, i: number): Cheerio<T> {
  i = +i;

  // Use the first identity optimization if possible
  if (i === 0 && this.length <= 1) return this;

  if (i < 0) i = this.length + i;
  return this._make(this[i] ?? []);
}

/**
 * Retrieve one of the elements matched by the Cheerio object, at the `i`th position.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('li').get(0).tagName;
 * //=> li
 * ```
 *
 * @param i - Element to retrieve.
 * @returns The element at the `i`th position.
 * @see {@link https://api.jquery.com/get/}
 */
export function get<T>(this: Cheerio<T>, i: number): T;
/**
 * Retrieve all elements matched by the Cheerio object, as an array.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('li').get().length;
 * //=> 3
 * ```
 *
 * @returns All elements matched by the Cheerio object.
 * @see {@link https://api.jquery.com/get/}
 */
export function get<T>(this: Cheerio<T>): T[];
export function get<T>(this: Cheerio<T>, i?: number): T | T[] {
  if (i == null) {
    return this.toArray();
  }
  return this[i < 0 ? this.length + i : i];
}

/**
 * Retrieve all the DOM elements contained in the jQuery set as an array.
 *
 * @example
 *
 * ```js
 * $('li').toArray();
 * //=> [ {...}, {...}, {...} ]
 * ```
 *
 * @returns The contained items.
 */
export function toArray<T>(this: Cheerio<T>): T[] {
  return Array.prototype.slice.call(this);
}

/**
 * Search for a given element from among the matched elements.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.pear').index();
 * //=> 2 $('.orange').index('li');
 * //=> 1
 * $('.apple').index($('#fruit, li'));
 * //=> 1
 * ```
 *
 * @param selectorOrNeedle - Element to look for.
 * @returns The index of the element.
 * @see {@link https://api.jquery.com/index/}
 */
export function index<T extends Node>(
  this: Cheerio<T>,
  selectorOrNeedle?: string | Cheerio<Node> | Node
): number {
  let $haystack: Cheerio<Node>;
  let needle;

  if (selectorOrNeedle == null) {
    $haystack = this.parent().children();
    needle = this[0];
  } else if (typeof selectorOrNeedle === 'string') {
    $haystack = this._make<Node>(selectorOrNeedle);
    needle = this[0];
  } else {
    $haystack = this;
    needle = isCheerio(selectorOrNeedle)
      ? selectorOrNeedle[0]
      : selectorOrNeedle;
  }

  return $haystack.get().indexOf(needle);
}

/**
 * Gets the elements matching the specified range (0-based position).
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('li').slice(1).eq(0).text();
 * //=> 'Orange'
 *
 * $('li').slice(1, 2).length;
 * //=> 1
 * ```
 *
 * @param start - An position at which the elements begin to be selected. If
 *   negative, it indicates an offset from the end of the set.
 * @param end - An position at which the elements stop being selected. If
 *   negative, it indicates an offset from the end of the set. If omitted, the
 *   range continues until the end of the set.
 * @returns The elements matching the specified range.
 * @see {@link https://api.jquery.com/slice/}
 */
export function slice<T>(
  this: Cheerio<T>,
  start?: number,
  end?: number
): Cheerio<T> {
  return this._make(Array.prototype.slice.call(this, start, end));
}

/**
 * End the most recent filtering operation in the current chain and return the
 * set of matched elements to its previous state.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('li').eq(0).end().length;
 * //=> 3
 * ```
 *
 * @returns The previous state of the set of matched elements.
 * @see {@link https://api.jquery.com/end/}
 */
export function end<T>(this: Cheerio<T>): Cheerio<Node> {
  return this.prevObject ?? this._make([]);
}

/**
 * Add elements to the set of matched elements.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('.apple').add('.orange').length;
 * //=> 2
 * ```
 *
 * @param other - Elements to add.
 * @param context - Optionally the context of the new selection.
 * @returns The combined set.
 * @see {@link https://api.jquery.com/add/}
 */
export function add<S extends Node, T extends Node>(
  this: Cheerio<T>,
  other: string | Cheerio<S> | S | S[],
  context?: Cheerio<S> | string
): Cheerio<S | T> {
  const selection = this._make(other, context);
  const contents = uniqueSort([...this.get(), ...selection.get()]);
  return this._make(contents);
}

/**
 * Add the previous set of elements on the stack to the current set, optionally
 * filtered by a selector.
 *
 * @category Traversing
 * @example
 *
 * ```js
 * $('li').eq(0).addBack('.orange').length;
 * //=> 2
 * ```
 *
 * @param selector - Selector for the elements to add.
 * @returns The combined set.
 * @see {@link https://api.jquery.com/addBack/}
 */
export function addBack<T extends Node>(
  this: Cheerio<T>,
  selector?: string
): Cheerio<Node> {
  return this.prevObject
    ? this.add(selector ? this.prevObject.filter(selector) : this.prevObject)
    : this;
}
