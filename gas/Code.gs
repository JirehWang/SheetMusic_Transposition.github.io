function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || '{}');

    if (data.action === 'save') {
      return saveSheet(data);
    }

    if (data.action === 'omr_transcribe') {
      return transcribeSheetMusic(data);
    }

    return jsonOutput({
      ok: false,
      error: 'Unknown action: ' + data.action,
    });
  } catch (err) {
    return jsonOutput({
      ok: false,
      error: String(err && err.stack ? err.stack : err),
    });
  }
}

function saveSheet(data) {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    return jsonOutput({
      ok: false,
      error: 'Missing Script Property: SPREADSHEET_ID',
    });
  }

  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
  sheet.appendRow([
    data.timestamp || new Date().toISOString(),
    data.title || '',
    data.type || '',
    data.content || '',
    data.semitones || 0,
  ]);

  return jsonOutput({ ok: true });
}

function transcribeSheetMusic(data) {
  var omrServiceUrl = PropertiesService.getScriptProperties().getProperty('OMR_SERVICE_URL');
  if (!omrServiceUrl) {
    return jsonOutput({
      ok: false,
      error: 'Missing Script Property: OMR_SERVICE_URL. GAS cannot run Audiveris/OpenCV directly; set this to an HTTP service that runs the OMR pipeline and returns chordText, abc, or musicXml.',
    });
  }

  var response = UrlFetchApp.fetch(omrServiceUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      fileName: data.fileName,
      mimeType: data.mimeType || 'application/pdf',
      fileBase64: data.fileBase64,
      output: data.output || 'chordText',
    }),
    muteHttpExceptions: true,
  });

  var status = response.getResponseCode();
  var body = response.getContentText();

  if (status < 200 || status >= 300) {
    return jsonOutput({
      ok: false,
      error: 'OMR service HTTP ' + status + ': ' + body.slice(0, 500),
    });
  }

  try {
    var parsed = JSON.parse(body);
    parsed.ok = parsed.ok !== false;
    return jsonOutput(parsed);
  } catch (err) {
    return jsonOutput({
      ok: true,
      chordText: body,
    });
  }
}
