use std::sync::Mutex;
use std::time::{Duration, Instant};

pub struct RateLimiter {
    last_call: Mutex<Option<Instant>>,
    min_interval: Duration,
}

impl RateLimiter {
    pub fn new(min_interval: Duration) -> Self {
        Self {
            last_call: Mutex::new(None),
            min_interval,
        }
    }

    pub async fn wait(&self) {
        let sleep_dur = {
            let guard = self.last_call.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
            guard.and_then(|last| {
                let elapsed = last.elapsed();
                self.min_interval.checked_sub(elapsed)
            })
        };
        if let Some(dur) = sleep_dur {
            tokio::time::sleep(dur).await;
        }
        let mut guard = self.last_call.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        *guard = Some(Instant::now());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn first_call_does_not_sleep() {
        let limiter = RateLimiter::new(Duration::from_secs(5));
        let start = Instant::now();
        limiter.wait().await;
        assert!(
            start.elapsed() < Duration::from_millis(50),
            "first call should return immediately"
        );
    }

    #[tokio::test]
    async fn second_call_waits_for_interval() {
        let limiter = RateLimiter::new(Duration::from_millis(100));
        limiter.wait().await;
        let start = Instant::now();
        limiter.wait().await;
        assert!(
            start.elapsed() >= Duration::from_millis(80),
            "second call should have waited ~100ms, elapsed: {:?}",
            start.elapsed()
        );
    }

    #[tokio::test]
    async fn no_wait_after_interval_passed() {
        let limiter = RateLimiter::new(Duration::from_millis(50));
        limiter.wait().await;
        tokio::time::sleep(Duration::from_millis(80)).await;
        let start = Instant::now();
        limiter.wait().await;
        assert!(
            start.elapsed() < Duration::from_millis(30),
            "should not wait when interval already passed"
        );
    }
}
