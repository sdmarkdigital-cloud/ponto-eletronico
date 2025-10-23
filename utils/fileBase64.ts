export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // remover o prefixo "data:...;base64,"
      const base64Data = result.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}
