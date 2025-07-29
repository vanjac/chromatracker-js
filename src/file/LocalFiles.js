const dbVersion = 1

/**
 * @typedef {{
 *      name: string
 *      created: Date
 *      modified: Date
 * }} Metadata
 */

export async function requestPersistentStorage() {
    if (!window.isSecureContext) {
        throw Error('Not a secure context (requires HTTPS).')
    }
    if (!navigator.storage) {
        throw Error('Storage API not supported.')
    }
    let persisted = await navigator.storage.persist()
    if (!persisted) {
        throw Error('Storage permission has not been granted.')
    }
    if (navigator.permissions) {
        let status
        try {
            status = await navigator.permissions.query({name: 'persistent-storage'})
        } catch (e) {
            // permission may not be supported by this browser; not an error
            console.warn(e)
            return
        }
        if (status.state != 'granted') {
            throw Error('Storage permission has not been granted.')
        }
    }
}

/**
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Promise<T>}
 */
function requestPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

/**
 * @param {IDBDatabase} db
 * @param {number} oldVersion
 */
function upgradeDB(db, oldVersion) {
    console.log('Upgrading DB from', oldVersion, 'to', dbVersion)
    let entriesStore = db.createObjectStore('entries', {autoIncrement: true})
    entriesStore.createIndex('name', 'name', {unique: false})
    entriesStore.createIndex('created', 'created', {unique: false})
    entriesStore.createIndex('modified', 'modified', {unique: false})
    db.createObjectStore('data')
}

export async function openDB() {
    let openReq = window.indexedDB.open('files', dbVersion)
    openReq.onupgradeneeded = e => upgradeDB(openReq.result, e.oldVersion)
    await requestPromise(openReq)
    return openReq.result
}

/**
 * Sorted by recently modified.
 * @param {IDBDatabase} db
 * @returns {Promise<Metadata[]>}
 */
export function listFiles(db) {
    let transaction = db.transaction('entries', 'readonly')
    let entriesStore = transaction.objectStore('entries')
    let modifiedIndex = entriesStore.index('modified')
    let request = modifiedIndex.openCursor()
    /** @type {Metadata[]} */
    let metadata = []
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            let cursor = request.result
            if (cursor) {
                metadata.push(cursor.value)
                cursor.continue()
            } else {
                resolve(metadata)
            }
        }
        request.onerror = () => reject(request.error)
    })
}

/**
 * @param {IDBDatabase} db
 * @param {number} id
 * @returns {Promise<ArrayBuffer>}
 */
export async function readFile(db, id) {
    let transaction = db.transaction('data', 'readonly')
    let dataStore = transaction.objectStore('data')
    return await requestPromise(dataStore.get(id))
}

/**
 * @param {IDBDatabase} db
 * @param {number} id Use null to create a new file
 * @param {string} name
 * @param {ArrayBuffer} data
 * @returns {Promise<number>} File ID
 */
export async function updateFile(db, id, name, data) {
    let transaction = db.transaction(['entries', 'data'], 'readwrite')
    let entriesStore = transaction.objectStore('entries')
    let dataStore = transaction.objectStore('data')

    let date = new Date()
    /** @type {Metadata} */
    let metadata
    if (id != null) {
        metadata = await requestPromise(entriesStore.get(id))
        metadata = {...metadata, name, modified: new Date()}
    } else {
        metadata = {name, created: date, modified: date}
    }

    id = /** @type {number} */(await requestPromise(entriesStore.put(metadata, id)))
    await requestPromise(dataStore.put(data, id))
    return id
}

/**
 * @param {IDBDatabase} db
 * @param {number} id
 */
export async function deleteFile(db, id) {
    let transaction = db.transaction(['entries', 'data'], 'readwrite')
    let entriesStore = transaction.objectStore('entries')
    let dataStore = transaction.objectStore('data')
    await Promise.all([
        requestPromise(entriesStore.delete(id)),
        requestPromise(dataStore.delete(id)),
    ])
}

if (import.meta.main) {
    ;/** @satisfies {Serializable} */(/** @type {Metadata} */(null))
}
