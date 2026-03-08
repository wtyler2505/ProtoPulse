/**
 * WGSL Compute Shader Generators for GPU-Accelerated Linear Algebra
 *
 * Each function returns a WGSL source string parameterized by the matrix
 * dimension N. Shaders operate on batched f32 arrays — one workgroup
 * invocation per RHS vector in the batch.
 *
 * Layout convention:
 *   - Matrices are stored row-major in a flat f32 array of length N*N
 *   - Batch vectors are stored contiguously: element [batchIdx * N + row]
 *   - global_invocation_id.x selects the batch index
 */

/** Default workgroup X dimension. */
const WORKGROUP_X = 64;

/**
 * Forward substitution shader: solve Ly = b for batched b vectors.
 *
 * Bindings:
 *   @group(0) @binding(0) L: array<f32>   — N*N lower-triangular matrix (row-major)
 *   @group(0) @binding(1) b: array<f32>   — batched RHS vectors (batchSize * N)
 *   @group(0) @binding(2) y: array<f32>   — batched output vectors (batchSize * N)
 */
export function forwardSubShader(n: number): string {
  if (n <= 0) {
    return '';
  }

  return `
const N: u32 = ${n}u;

@group(0) @binding(0) var<storage, read> L: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> y: array<f32>;

@compute @workgroup_size(${WORKGROUP_X})
fn forward_sub(@builtin(global_invocation_id) gid: vec3u) {
  let batch = gid.x;
  let offset = batch * N;

  for (var i: u32 = 0u; i < N; i = i + 1u) {
    var sum: f32 = b[offset + i];
    for (var j: u32 = 0u; j < i; j = j + 1u) {
      sum = sum - L[i * N + j] * y[offset + j];
    }
    let diag = L[i * N + i];
    if (diag != 0.0) {
      y[offset + i] = sum / diag;
    } else {
      y[offset + i] = 0.0;
    }
  }
}
`;
}

/**
 * Back substitution shader: solve Ux = y for batched y vectors.
 *
 * Bindings:
 *   @group(0) @binding(0) U: array<f32>   — N*N upper-triangular matrix (row-major)
 *   @group(0) @binding(1) y: array<f32>   — batched input vectors (batchSize * N)
 *   @group(0) @binding(2) x: array<f32>   — batched output vectors (batchSize * N)
 */
export function backSubShader(n: number): string {
  if (n <= 0) {
    return '';
  }

  return `
const N: u32 = ${n}u;

@group(0) @binding(0) var<storage, read> U: array<f32>;
@group(0) @binding(1) var<storage, read> y: array<f32>;
@group(0) @binding(2) var<storage, read_write> x: array<f32>;

@compute @workgroup_size(${WORKGROUP_X})
fn back_sub(@builtin(global_invocation_id) gid: vec3u) {
  let batch = gid.x;
  let offset = batch * N;

  for (var ii: u32 = 0u; ii < N; ii = ii + 1u) {
    let i: u32 = N - 1u - ii;
    var sum: f32 = y[offset + i];
    for (var j: u32 = i + 1u; j < N; j = j + 1u) {
      sum = sum - U[i * N + j] * x[offset + j];
    }
    let diag = U[i * N + i];
    if (diag != 0.0) {
      x[offset + i] = sum / diag;
    } else {
      x[offset + i] = 0.0;
    }
  }
}
`;
}

/**
 * Matrix-vector multiply shader: y = A * x for batched x vectors.
 *
 * Bindings:
 *   @group(0) @binding(0) A: array<f32>   — N*N matrix (row-major)
 *   @group(0) @binding(1) x: array<f32>   — batched input vectors (batchSize * N)
 *   @group(0) @binding(2) y: array<f32>   — batched output vectors (batchSize * N)
 */
export function matVecMulShader(n: number): string {
  if (n <= 0) {
    return '';
  }

  return `
const N: u32 = ${n}u;

@group(0) @binding(0) var<storage, read> A: array<f32>;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> y: array<f32>;

@compute @workgroup_size(${WORKGROUP_X})
fn mat_vec_mul(@builtin(global_invocation_id) gid: vec3u) {
  let batch = gid.x;
  let offset = batch * N;

  for (var i: u32 = 0u; i < N; i = i + 1u) {
    var sum: f32 = 0.0;
    for (var j: u32 = 0u; j < N; j = j + 1u) {
      sum = sum + A[i * N + j] * x[offset + j];
    }
    y[offset + i] = sum;
  }
}
`;
}

/**
 * Combined batch-solve shader: performs LU-based forward + back substitution
 * in a single dispatch. Expects a pre-factored LU matrix (L in lower triangle
 * with unit diagonal implied, U in upper triangle including diagonal).
 *
 * Bindings:
 *   @group(0) @binding(0) LU: array<f32>  — N*N LU-factored matrix (row-major)
 *   @group(0) @binding(1) b: array<f32>   — batched RHS vectors (batchSize * N)
 *   @group(0) @binding(2) x: array<f32>   — batched solution vectors (batchSize * N)
 */
export function batchSolveShader(n: number): string {
  if (n <= 0) {
    return '';
  }

  return `
const N: u32 = ${n}u;

@group(0) @binding(0) var<storage, read> LU: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> x: array<f32>;

@compute @workgroup_size(${WORKGROUP_X})
fn batch_solve(@builtin(global_invocation_id) gid: vec3u) {
  let batch = gid.x;
  let offset = batch * N;

  // Forward substitution (L * y = b, L has unit diagonal)
  for (var i: u32 = 0u; i < N; i = i + 1u) {
    var sum: f32 = b[offset + i];
    for (var j: u32 = 0u; j < i; j = j + 1u) {
      sum = sum - LU[i * N + j] * x[offset + j];
    }
    x[offset + i] = sum;
  }

  // Back substitution (U * x = y)
  for (var ii: u32 = 0u; ii < N; ii = ii + 1u) {
    let i: u32 = N - 1u - ii;
    var sum: f32 = x[offset + i];
    for (var j: u32 = i + 1u; j < N; j = j + 1u) {
      sum = sum - LU[i * N + j] * x[offset + j];
    }
    let diag = LU[i * N + i];
    if (diag != 0.0) {
      x[offset + i] = sum / diag;
    } else {
      x[offset + i] = 0.0;
    }
  }
}
`;
}

/**
 * Calculate the number of workgroups to dispatch for a given batch size.
 * Each workgroup has WORKGROUP_X invocations, one per batch element.
 */
export function workgroupSize(batchSize: number): number {
  return Math.max(1, Math.ceil(batchSize / WORKGROUP_X));
}
