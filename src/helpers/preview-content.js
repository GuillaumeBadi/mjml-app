import erb from 'erb'

export const compile = async ({ raw, engine, variables = {} }) => {
  if (engine === 'erb') {
    const res = await erb({
      timeout: 5000,
      data: { values: variables },
      template: raw,
    })

    return res
  }

  return raw
}
