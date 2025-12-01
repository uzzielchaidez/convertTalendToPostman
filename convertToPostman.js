const fs = require('fs')
const path = require('path')
const schema = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'

const remappers = {
  'somesecurethinglikeapasswordoranauthtoken': '{{VARIABLE}}'
}

const processHeaders = (headers = []) => {
  const authHeader = headers.find((h) => h.name.toLowerCase() === 'authorization')
  const remaining = headers.filter((h) => h !== authHeader)

  const auth = authHeader && authHeader.enabled && {
    type: 'bearer',
    bearer: [{
      key: 'token',
      value: authHeader.value.replace(/^bearer /i, ''),
      type: 'string'
    }]
  }

  const headersOut = remaining.map(({ enabled, name: key, value }) => {
    return { key, value, disabled: !enabled }
  })

  return { auth: auth || null, headers: headersOut }
}


const toPostmanRequest = (request) => {
  const { headers: header, auth } = processHeaders(request.headers);

  // Validar si existe request.body
  const body = request.body
    ? {
        mode: request.body.bodyType === 'Text' ? 'raw' : 'formdata',
        raw: request.body.textBody || ''
      }
    : undefined; // Si no hay body, no lo incluimos

  return {
    name: request.name,
    request: {
      method: request.method.name,
      header,
      auth,
      ...(body ? { body } : {}), // Solo agregar body si existe
      url: `${request.uri.scheme.name}://${request.uri.host}${request.uri.path}`
    }
  };
};


const processEntity = ({ entity, children = [] }) => {
  if (entity.type === 'Request') return toPostmanRequest(entity)
  if (!children.length) return null

  const item = children.map((child) => processEntity(child)) || []
  return { name: entity.name, item }
}

const convertToPostman = (inputFilePath) => {
  const { entities } = JSON.parse(fs.readFileSync(inputFilePath))
  const projects = entities.filter(({ entity }) => entity.type === 'Project')

  for (const { entity: { name }, children = [] } of projects) {
    const outputData = {
      info: { name, schema },
      item: children.map((entity) => processEntity(entity)).filter((el) => el)
    }

    const jsonOutRaw = JSON.stringify(outputData, null, 2)
    const jsonOut = Object.entries(remappers).reduce((out, [init, replace]) => {
      return out.replaceAll(init, replace)
    }, jsonOutRaw)

    const outDir = path.join(path.dirname(inputFilePath), 'output')
    const outFile = path.join(outDir, `postman-${name}.json`)

    fs.writeFileSync(outFile, jsonOut)
  }
}

const inputFilePath = process.argv[2]

convertToPostman(inputFilePath)