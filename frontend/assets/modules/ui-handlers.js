// ui-handlers.js
// Event Handler für WirKaufenFair

// Dummy-Variablen für Demo (werden im Main-Modul ersetzt)
let shoppingList = [];

export function setHandlerContext(list) {
    shoppingList = list;
}

export function addItem(item) {
    shoppingList.push(item);
    // ...weitere Logik (z.B. persistieren, rendern)
}

export function removeItem(index) {
    shoppingList.splice(index, 1);
    // ...weitere Logik (z.B. persistieren, rendern)
}

export function changeItemCount(index, delta) {
    const it = shoppingList[index];
    if (!it) return;
    if (!it.calculation) {
        it.calculation = { count: 1 };
    }
    it.calculation.count = Math.max(1, (it.calculation.count || 1) + delta);
    // ...weitere Logik (z.B. persistieren, rendern)
}

export function setItemNotes(index, notes) {
    const it = shoppingList[index];
    if (!it) return;
    it.notes = notes;
    // ...weitere Logik (z.B. persistieren)
}

export function setItemRating(index, rating) {
    const it = shoppingList[index];
    if (!it) return;
    it.rating = rating;
    // ...weitere Logik (z.B. persistieren)
}

export async function submitPrice(index, price, store) {
    // ...API-Call zum Backend
}

export function exportList() {
    // ...Export-Logik
}
