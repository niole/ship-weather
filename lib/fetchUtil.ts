export function handleFetch<R>(url: string, metadata: any = undefined, isJson: boolean = true, isText: boolean = false, raw: boolean = false): Promise<R> {

  return fetch(url, metadata)
  .then(async response => {
    let body;
    if (raw) {
      body = response.body;
    }
    if (isText) {
      body =response.text();
    }
    if (isJson) {
      body = response.json();
    }

    if (response.ok) {
      return body;
    } else {
      let errorMsg;
      if (raw || isText) {
        errorMsg = await response.text();
      }
      if (isJson) {
        errorMsg = (await body).error;
      }

      throw new Error(`${response.statusText}: ${errorMsg}`);
    }
  });
}