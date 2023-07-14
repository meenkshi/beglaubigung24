/*
  # Intro
  When the customer uploads a document, we want to update the total page count the customer
  is ordering based on the uploaded document. Currently, we only count pages in PDF
  documents; every other uploaded document is counted simply as being one page.
  
  The actual counting of pages in a PDF is suprisingly straighforward (see `countPdfPages`).
  
  The upload process is provided by a Shopify plugin called cloudlift. They, in turn, use an
  open source upload plugin called `filepond` (https://pqina.nl/filepond/).

  # Basic flow
  The filepond plugin helpfully fires events on the document whenever something interesting
  happens. This script listens to those events, counting the pages in the added file, and
  then updating the page count. Similarly, when a file is removed, the page count is
  reduced accordingly. In both cases, an absolute update is done by getting all files from
  the filepond instance and then getting the page count for each files from our local page
  count cache.

  # Why a page count cache?
  This upload plugin has a feature that allows uploaded files to be kept across browser page
  reload (It does so by storing some key information about the uploaded files in the
  localstorage. I'm not quite if this is a filepond feature or something that is added by
  cloudlift).
  
  When a file is first uploaded, the `FilePond:addfile` event provides us with a Javascript
  File object, which allows us to read the file content and count the pages. After a page
  reload, the `FilePond:addfile` event is fired again (this is good), but the event does
  not inlcude the Javascript File object, as it can't be stored in the localstorage. This
  means we have no way of counting the pages again.
  The solution is a cache which stores the page count of each uploaded file by the serverId
  of that file.
*/
(async function () {
  function log() {
    // console.log.apply(console, arguments);
  }

  const cache = {
    load() {
      const l = localStorage.getItem(this.localStorageKey);
      try {
        const parsed = JSON.parse(l);
        this.cache = typeof parsed === "object" && parsed !== null ? parsed : {};
      } catch (e) {
        log("cache error", e);
        this.cache = {};
      }
    },
    save() {
      localStorage.setItem(this.localStorageKey, JSON.stringify(this.cache));
    },
    setKey(key, value) {
      this.cache[key] = value;
      this.save();
    },
    getKey(key) {
      return this.cache[key];
    },
    hasKey(key) {
      return this.cache.hasOwnProperty(key);
    },
    clearExcept(exceptKeys) {
      Object.keys(this.cache).forEach((key) => {
        if (!exceptKeys.includes(key)) {
          delete this.cache[key];
        }
      });
      this.save();
    },
    localStorageKey: "uploadPageCountCache",
    cache: {},
  };
  cache.load();

  function readAsBinaryString(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  }

  async function countPdfPages(file) {
    const fileContent = await readAsBinaryString(file);
    const matches = fileContent.match(/\/Type[\s]*\/Page[^s]/g);
    if (!matches) {
      return 1;
    }
    const pageCount = matches.length;
    log("countPdfPages", file.name, pageCount);

    return pageCount;
  }

  async function analyzeFile(file) {
    log("analyzeFile", { type: file.type });
    if (file.type === "application/pdf") {
      return await countPdfPages(file);
    } else {
      return 1;
    }
  }

  async function addFile(detail) {
    log("addFile", { detail, serverId: detail.file.serverId });
    if (!File.prototype.isPrototypeOf(detail.file.file)) {
      // After a reload, detail.file.file only contains a string (the serverId)
      // instead of the whole file object.
      return;
    }
    // when adding a file to the cache, we first set the key to null. This acts as a
    // marker that we are in the process of adding this file. We then asynchronously 
    // count the pages. Technically, the file might, in the meantime, be removed by
    // the user. So when the page counting is done, we check if our key is still in
    // the cache before adding the count.
    const cacheKey = detail.file.serverId;
    cache.setKey(cacheKey, null);
    const pageCount = await analyzeFile(detail.file.file);
    log("addFile", { pageCount });
    if (cache.hasKey(cacheKey)) {
      cache.setKey(cacheKey, pageCount);
      updatePageCount(detail.pond.getFiles());
    }
  }

  function getPageCount(files) {
    const cacheKeys = files.map((f) => f.serverId);
    const pageCounts = cacheKeys.map((key) => cache.getKey(key) || 0);
    cache.clearExcept(cacheKeys);

    return pageCounts.reduce((acc, pageCount) => acc + pageCount, 0);
  }

  function updatePageCount(files) {
    const pageCount = getPageCount(files);
    log("updatePageCount", { pageCount });
    const element = document.querySelector("quantity-input .quantity__input");
    element.value = pageCount || 1;
    element.dispatchEvent(new Event("change"));
  }

  document.addEventListener("FilePond:init", async (event) => {
    log("FilePond:init", event.detail);
    log("FilePond:init files", event.detail.pond.getFiles());
    updatePageCount(event.detail.pond.getFiles());
  });

  // FilePond:processfile is fired when the upload is complete
  document.addEventListener("FilePond:processfile", async (event) => {
    log("FilePond:processfile", event.detail);
    addFile(event.detail);
  });

  document.addEventListener("FilePond:removefile", (event) => {
    log("FilePond:removefile", event.detail);
    updatePageCount(event.detail.pond.getFiles());
  });
})();
