const formArticulo = document.querySelector("#formArticulo");

formArticulo.addEventListener("submit", async function (e) {
  e.preventDefault();
  const formdata = new FormData(formArticulo);

  const req = await fetch("/inventario/articulos/", {
    method: "POST",
    body: formdata,
  });

  const res = await req.json();
  console.log(res);

  await swalConfirmationAndReload("Se creo con exito");
  //   window.location.reload();
});

// Solicitar acceso a la cámara
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const photoInput = document.getElementById("foto");
const startCamera = document.getElementById("startCamera");
const takePhoto = document.getElementById("takePhoto");

let stream;

// Activar la cámara
startCamera.addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.style.display = "block";
    takePhoto.style.display = "inline-block";
    startCamera.style.display = "none";
  } catch (error) {
    console.error("Error al acceder a la cámara:", error);
  }
});

// Tomar la foto y detener la cámara
takePhoto.addEventListener("click", () => {
  // Dibujar el video en el canvas
  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convertir el contenido del canvas a un archivo Blob
  canvas.toBlob((blob) => {
    // Crear un archivo a partir del Blob
    const file = new File([blob], "photo.jpg", { type: "image/jpeg" });

    // Crear un objeto DataTransfer para asignar el archivo al input
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    photoInput.files = dataTransfer.files;

    // Detener la cámara
    stream.getTracks().forEach((track) => track.stop());
    video.style.display = "none";
    takePhoto.style.display = "none";
    startCamera.style.display = "inline-block";

    alert("Foto capturada y asignada al campo de archivo.");
  }, "image/jpeg");
});
