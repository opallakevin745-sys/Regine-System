export function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
}

export function errorHandler(error, req, res, next) {
  console.error(error);
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'A record with the same unique value already exists' });
  }
  if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return res.status(400).json({ success: false, message: 'One or more values are outside the allowed range' });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body is not valid JSON' });
  }
  if (error.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ success: false, message: 'This record is in use and cannot be removed' });
  }
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : 'An unexpected server error occurred'
  });
}
