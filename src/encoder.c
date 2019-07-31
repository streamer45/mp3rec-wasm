#include <stdlib.h>
#include <stdint.h>
#include <emscripten.h>
#include "lame/lame.h"

typedef struct {
  lame_global_flags *lame;
} encoder_t;

EMSCRIPTEN_KEEPALIVE int encoder_destroy(encoder_t *enc) {
  if (!enc) return -1;
  if (enc->lame) free(enc->lame);
  free(enc);
  return 0;
}

EMSCRIPTEN_KEEPALIVE encoder_t *encoder_create(int rate, int channels, int bitrate) {
  int ret;
  encoder_t *enc;

  if (rate <= 0) return NULL;
  if (channels != 1 && channels != 2) return NULL;
  if (bitrate < 0 || bitrate > 320) return NULL;

  enc = calloc(1, sizeof(*enc));
  if (!enc) return NULL;

  enc->lame = lame_init();
  if (!enc->lame) {
    encoder_destroy(enc);
    return NULL;
  }

  lame_set_in_samplerate(enc->lame, rate);
  lame_set_num_channels(enc->lame, channels);
  lame_set_VBR(enc->lame, vbr_off);
  lame_set_brate(enc->lame, bitrate);

  ret = lame_init_params(enc->lame);
  if (ret == -1) {
    encoder_destroy(enc);
    return NULL;
  }

  return enc;
}

EMSCRIPTEN_KEEPALIVE ssize_t encoder_encode(encoder_t *enc, float *right, float *left,
 int nsamples, uint8_t *out, int out_sz) {
  ssize_t ret;

  if (!enc) return -1;
  if (!right || !left) return -2;
  if (!nsamples) return -3;
  if (!out || !out_sz) return -4;

  ret = lame_encode_buffer_ieee_float(enc->lame, right, left, nsamples, out, out_sz);
  return ret;
}

EMSCRIPTEN_KEEPALIVE ssize_t encoder_flush(encoder_t *enc, uint8_t *out, int out_sz) {
  ssize_t ret;

  if (!enc) return -1;
  if (!out || !out_sz) return -2;

  ret = lame_encode_flush(enc->lame, out, out_sz);
  return ret;
}
