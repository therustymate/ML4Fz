const copyButton = document.querySelector("[data-copy]");

if (copyButton) {
    copyButton.addEventListener("click", async () => {
        const target = document.querySelector(copyButton.dataset.copy);

        if (!target) {
            return;
        }

        const text = target.innerText
            .replace(/^>>>\s?/gm, "")
            .trim();

        try {
            await navigator.clipboard.writeText(text);

            const label = copyButton.querySelector("span");
            const icon = copyButton.querySelector("i");

            if (label) {
                label.textContent = "COPIED";
            }

            if (icon) {
                icon.className = "fa-solid fa-check";
            }

            setTimeout(() => {
                if (label) {
                    label.textContent = "COPY";
                }

                if (icon) {
                    icon.className = "fa-regular fa-copy";
                }
            }, 1200);
        } catch {
            const label = copyButton.querySelector("span");
            const icon = copyButton.querySelector("i");

            if (label) {
                label.textContent = "FAILED";
            }

            if (icon) {
                icon.className = "fa-solid fa-xmark";
            }
        }
    });
}






const flowSimulator = document.querySelector("[data-flow-sim]");

if (flowSimulator) {
    const steps = [...flowSimulator.querySelectorAll("[data-step]")];
    const connectors = [...flowSimulator.querySelectorAll("[data-connector]")];
    const cycleCount = flowSimulator.querySelector("[data-cycle-count]");
    const activeStage = flowSimulator.querySelector("[data-active-stage]");
    const activeStatus = flowSimulator.querySelector("[data-active-status]");
    const monitorSignals = flowSimulator.querySelector("[data-monitor-signals]");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const feedbackRoute = flowSimulator.querySelector("[data-feedback-return-route]");
    const feedbackRouteLine = flowSimulator.querySelector("[data-feedback-return-line]");
    const feedbackRoutePulse = flowSimulator.querySelector("[data-feedback-return-pulse]");

    let feedbackRouteFrame = null;

    const stepOrder = [
        "discover",
        "generate",
        "mutation",
        "execute",
        "triage",
        "feedback"
    ];

    const bootstrapSequence = [
        {
            type: "stage",
            id: "discover",
            label: "DISCOVER",
            status: "Inspecting the EAT function list and identifying user-configured fuzzing targets.",
            signals: ["EAT", "user target"],
            duration: 1400
        },
        {
            type: "transfer",
            connector: "discover-generate",
            label: "DISCOVER → GENERATE",
            status: "Passing the identified target into seed generation.",
            signals: ["EAT", "user target"],
            duration: 650
        },
        {
            type: "stage",
            id: "generate",
            label: "GENERATE",
            status: "Automatically generating seed inputs or loading user-specified seeds.",
            signals: ["auto seed", "user seed"],
            duration: 1450
        },
        {
            type: "transfer",
            connector: "generate-mutation",
            label: "GENERATE → MUTATION",
            status: "Passing seed inputs into ML-guided mutation.",
            signals: ["auto seed", "user seed"],
            duration: 650
        },
        {
            type: "stage",
            id: "mutation",
            label: "MUTATE",
            status: "Using ML to adapt the fuzzing strategy and mutate fuzzing data.",
            signals: ["ML strategy", "mutated data"],
            duration: 1900
        },
        {
            type: "transfer",
            connector: "mutation-execute",
            label: "MUTATION → EXECUTE",
            status: "Providing the current fuzzing data to the target function.",
            signals: ["fuzzing data"],
            duration: 650
        },
        {
            type: "stage",
            id: "execute",
            label: "EXECUTE",
            status: "Executing the target function with the current fuzzing data.",
            signals: ["execution result"],
            duration: 1450
        },
        {
            type: "transfer",
            connector: "execute-triage",
            label: "EXECUTE → TRIAGE",
            status: "Forwarding execution results for crash and reached-branch analysis.",
            signals: ["runtime result"],
            duration: 650
        },
        {
            type: "stage",
            id: "triage",
            label: "TRIAGE",
            status: "Identifying and analyzing crash data and branches reached during execution.",
            signals: ["crash data", "reached branch"],
            duration: 1550
        },
        {
            type: "transfer",
            connector: "triage-feedback",
            label: "TRIAGE → FEEDBACK",
            status: "Passing analyzed crash and branch results into feedback.",
            signals: ["crash data", "reached branch"],
            duration: 650
        },
        {
            type: "feedback",
            id: "feedback",
            label: "FEEDBACK",
            status: "Using observed results to provide ML-based fuzzing strategy and data-mutation feedback.",
            signals: ["crash data", "reached branch"],
            duration: 1500
        }
    ];

    const loopSequence = [
        {
            type: "feedback-route",
            label: "FEEDBACK → MUTATE",
            status: "Routing analyzed results directly into ML-guided mutation.",
            signals: ["feedback", "crash data", "reached branch"],
            duration: 980,
            completesReturn: true
        },
        {
            type: "stage",
            id: "mutation",
            label: "MUTATE / UPDATED",
            status: "ML fuzzing strategy and data mutation have been updated before the next execution.",
            signals: ["updated ML strategy", "updated fuzzing data"],
            duration: 2800,
            postFeedback: true
        },
        {
            type: "transfer",
            connector: "mutation-execute",
            label: "MUTATION → EXECUTE",
            status: "Providing the updated fuzzing data to the target function.",
            signals: ["fuzzing data"],
            duration: 620
        },
        {
            type: "stage",
            id: "execute",
            label: "EXECUTE",
            status: "Executing the target function with the updated fuzzing data.",
            signals: ["execution result"],
            duration: 1400
        },
        {
            type: "transfer",
            connector: "execute-triage",
            label: "EXECUTE → TRIAGE",
            status: "Forwarding results for crash and reached-branch analysis.",
            signals: ["runtime result"],
            duration: 620
        },
        {
            type: "stage",
            id: "triage",
            label: "TRIAGE",
            status: "Identifying and analyzing crash data and branches reached during execution.",
            signals: ["crash data", "reached branch"],
            duration: 1450
        },
        {
            type: "transfer",
            connector: "triage-feedback",
            label: "TRIAGE → FEEDBACK",
            status: "Passing triage results into ML-based feedback.",
            signals: ["triage result", "reached branch"],
            duration: 620
        },
        {
            type: "feedback",
            id: "feedback",
            label: "FEEDBACK",
            status: "Providing feedback for the next ML fuzzing strategy and data mutation.",
            signals: ["crash data", "reached branch"],
            duration: 1450
        }
    ];

    let phaseIndex = 0;
    let loopPhaseIndex = 0;
    let cycle = 1;
    let hasBootstrapped = false;
    let timer = null;

    const setMonitorSignals = (signals, highlighted = false) => {
        monitorSignals.innerHTML = "";

        signals.forEach((signal) => {
            const tag = document.createElement("span");
            tag.textContent = signal.toUpperCase();

            if (highlighted) {
                tag.classList.add("is-lit");
            }

            monitorSignals.appendChild(tag);
        });
    };

    const clearVisualState = () => {
        steps.forEach((step) => {
            step.classList.remove(
                "is-active",
                "is-complete",
                "is-dimmed",
                "is-feedback-target",
                "is-return-source",
                "is-return-pass"
            );
        });

        connectors.forEach((connector) => {
            connector.classList.remove(
                "is-active",
                "is-complete",
                "is-return-active",
                "is-rapid-return"
            );
        });

        if (feedbackRoute) {
            feedbackRoute.classList.remove("is-active", "is-arrived");
        }

        if (feedbackRouteFrame) {
            window.cancelAnimationFrame(feedbackRouteFrame);
            feedbackRouteFrame = null;
        }
    };

    const markCompletedBefore = (stepId) => {
        const currentIndex = stepOrder.indexOf(stepId);

        steps.forEach((step) => {
            const index = stepOrder.indexOf(step.dataset.step);

            if (index > -1 && index < currentIndex) {
                step.classList.add("is-complete");
            }
        });

        connectors.forEach((connector, index) => {
            if (index < currentIndex) {
                connector.classList.add("is-complete");
            }
        });
    };

    const renderTransferPhase = (phase) => {
        const connectorIndex = connectors.findIndex(
            (connector) => connector.dataset.connector === phase.connector
        );

        steps.forEach((step) => {
            const index = stepOrder.indexOf(step.dataset.step);

            if (index <= connectorIndex) {
                step.classList.add("is-complete");
            } else {
                step.classList.add("is-dimmed");
            }
        });

        connectors.forEach((connector, index) => {
            if (index < connectorIndex) {
                connector.classList.add("is-complete");
            } else if (index === connectorIndex) {
                connector.classList.add("is-active");
            }
        });
    };

    const renderFeedbackPhase = () => {
        steps.forEach((step) => {
            step.classList.add("is-complete");
        });

        connectors.forEach((connector) => {
            connector.classList.add("is-complete");
        });

        const feedbackStep = steps.find(
            (step) => step.dataset.step === "feedback"
        );

        if (feedbackStep) {
            feedbackStep.classList.remove("is-complete");
            feedbackStep.classList.add("is-active");
        }
    };

    const renderReturnPhase = (phase) => {
        steps.forEach((step) => {
            step.classList.add("is-complete");
        });

        connectors.forEach((connector) => {
            connector.classList.add("is-complete");
        });

        const source = steps.find(
            (step) => step.dataset.step === phase.source
        );
        const target = steps.find(
            (step) => step.dataset.step === phase.target
        );
        const connector = connectors.find(
            (item) => item.dataset.connector === phase.connector
        );

        if (source) {
            source.classList.remove("is-complete");
            source.classList.add("is-return-source");
        }

        if (target) {
            target.classList.remove("is-complete");
            target.classList.add("is-feedback-target", "is-return-pass");
        }

        if (connector) {
            connector.classList.remove("is-complete");
            connector.classList.add("is-return-active");
        }
    };


    const updateFeedbackRoute = () => {
        if (!feedbackRoute || !feedbackRouteLine || !feedbackRoutePulse) {
            return;
        }

        const track = flowSimulator.querySelector(".flow-track");
        const feedbackStep = flowSimulator.querySelector('[data-step="feedback"]');
        const mutationStep = flowSimulator.querySelector('[data-step="mutation"]');

        if (!track || !feedbackStep || !mutationStep) {
            return;
        }

        const trackRect = track.getBoundingClientRect();
        const feedbackRect = feedbackStep.getBoundingClientRect();
        const mutationRect = mutationStep.getBoundingClientRect();

        const width = Math.max(track.scrollWidth, track.clientWidth);
        const height = Math.max(track.scrollHeight, track.clientHeight);
        const startX = feedbackRect.left - trackRect.left + feedbackRect.width / 2 + track.scrollLeft;
        const startY = feedbackRect.bottom - trackRect.top;
        const endX = mutationRect.left - trackRect.left + mutationRect.width / 2 + track.scrollLeft;
        const endY = mutationRect.bottom - trackRect.top;
        const routeY = Math.max(startY, endY) + 46;
        const cornerRadius = 18;

        feedbackRoute.setAttribute("viewBox", `0 0 ${width} ${height}`);
        feedbackRoute.style.width = `${width}px`;
        feedbackRoute.style.height = `${height}px`;

        const direction = endX < startX ? -1 : 1;
        const horizontalStart = startX + direction * cornerRadius;
        const horizontalEnd = endX - direction * cornerRadius;

        const pathData = [
            `M ${startX} ${startY}`,
            `L ${startX} ${routeY - cornerRadius}`,
            `Q ${startX} ${routeY} ${horizontalStart} ${routeY}`,
            `L ${horizontalEnd} ${routeY}`,
            `Q ${endX} ${routeY} ${endX} ${routeY - cornerRadius}`,
            `L ${endX} ${endY}`
        ].join(" ");

        feedbackRouteLine.setAttribute("d", pathData);
        feedbackRoutePulse.setAttribute("cx", String(startX));
        feedbackRoutePulse.setAttribute("cy", String(startY));
    };

    const animateFeedbackRoute = (duration) => {
        if (!feedbackRoute || !feedbackRouteLine || !feedbackRoutePulse) {
            return;
        }

        updateFeedbackRoute();

        const routeLength = feedbackRouteLine.getTotalLength();
        const startedAt = performance.now();

        feedbackRoute.classList.add("is-active");

        const movePulse = (now) => {
            const elapsed = now - startedAt;
            const progress = Math.min(1, elapsed / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const point = feedbackRouteLine.getPointAtLength(routeLength * eased);

            feedbackRoutePulse.setAttribute("cx", point.x.toFixed(2));
            feedbackRoutePulse.setAttribute("cy", point.y.toFixed(2));

            if (progress < 1) {
                feedbackRouteFrame = window.requestAnimationFrame(movePulse);
                return;
            }

            feedbackRoute.classList.add("is-arrived");
            feedbackRouteFrame = null;
        };

        feedbackRouteFrame = window.requestAnimationFrame(movePulse);
    };

    const renderFeedbackRoutePhase = (phase) => {
        steps.forEach((step) => {
            step.classList.add("is-complete");
        });

        connectors.forEach((connector) => {
            connector.classList.add("is-complete");
        });

        const feedbackStep = steps.find(
            (step) => step.dataset.step === "feedback"
        );
        const mutationStep = steps.find(
            (step) => step.dataset.step === "mutation"
        );

        if (feedbackStep) {
            feedbackStep.classList.remove("is-complete");
            feedbackStep.classList.add("is-return-source");
        }

        if (mutationStep) {
            mutationStep.classList.remove("is-complete");
            mutationStep.classList.add("is-feedback-target");
        }

        const animationDuration = prefersReducedMotion.matches
            ? 180
            : Math.max(360, phase.duration - 80);

        animateFeedbackRoute(animationDuration);
    };

    const renderPhase = (phase) => {
        clearVisualState();

        if (phase.type === "stage") {
            markCompletedBefore(phase.id);

            const currentStep = steps.find(
                (step) => step.dataset.step === phase.id
            );

            if (currentStep) {
                currentStep.classList.add("is-active");
            }

            steps.forEach((step) => {
                const index = stepOrder.indexOf(step.dataset.step);
                const currentIndex = stepOrder.indexOf(phase.id);

                if (index > currentIndex) {
                    step.classList.add("is-dimmed");
                }
            });

            if (phase.postFeedback && currentStep) {
                currentStep.classList.add("is-feedback-target");
            }
        }

        if (phase.type === "transfer") {
            renderTransferPhase(phase);
        }

        if (phase.type === "feedback") {
            renderFeedbackPhase();
        }

        if (phase.type === "return") {
            renderReturnPhase(phase);
        }

        if (phase.type === "feedback-route") {
            renderFeedbackRoutePhase(phase);
        }

        cycleCount.textContent = String(cycle).padStart(3, "0");
        activeStage.textContent = phase.label;
        activeStatus.textContent = phase.status;

        setMonitorSignals(
            phase.signals,
            phase.type === "feedback" ||
            phase.type === "return" ||
            phase.type === "feedback-route" ||
            Boolean(phase.postFeedback)
        );
    };

    const getCurrentPhase = () => {
        if (!hasBootstrapped) {
            return bootstrapSequence[phaseIndex];
        }

        return loopSequence[loopPhaseIndex];
    };

    const advance = () => {
        const phase = getCurrentPhase();
        renderPhase(phase);

        const duration = prefersReducedMotion.matches
            ? Math.min(320, phase.duration)
            : phase.duration;

        timer = window.setTimeout(() => {
            if (!hasBootstrapped) {
                phaseIndex += 1;

                if (phaseIndex >= bootstrapSequence.length) {
                    hasBootstrapped = true;
                    loopPhaseIndex = 0;
                }
            } else {
                if (phase.completesReturn) {
                    cycle += 1;
                }

                loopPhaseIndex = (
                    loopPhaseIndex + 1
                ) % loopSequence.length;
            }

            advance();
        }, duration);
    };

    const restart = () => {
        if (timer) {
            window.clearTimeout(timer);
        }

        phaseIndex = 0;
        loopPhaseIndex = 0;
        cycle = 1;
        hasBootstrapped = false;

        advance();
    };

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            if (timer) {
                window.clearTimeout(timer);
            }
        } else {
            restart();
        }
    });

    prefersReducedMotion.addEventListener("change", restart);


    const flowTrack = flowSimulator.querySelector(".flow-track");

    window.addEventListener("resize", updateFeedbackRoute);

    if (flowTrack) {
        flowTrack.addEventListener(
            "scroll",
            updateFeedbackRoute,
            { passive: true }
        );
    }

    updateFeedbackRoute();

    advance();
}


const showcase = document.querySelector("[data-showcase]");

if (showcase) {
    const slides = [
        {
            kicker: "TARGET SURFACE",
            title: "Export Discovery",
            description:
                "Enumerate exported DLL functions and build a clear target surface before fuzzing begins.",
            tags: ["EAT", "EXPORTS", "TARGET MAP"],
            image: "./assets/showcase/export-discovery.svg",
            imageAlt: "ML4Fz export discovery example",
            imageLabel: "VIEW / EXPORT DISCOVERY",
            address: "0x140001120"
        },
        {
            kicker: "INPUT EXPLORATION",
            title: "Mutation Campaign",
            description:
                "Generate malformed, boundary-stress and ML-assisted inputs while keeping the mutation strategy replaceable.",
            tags: ["BOUNDARY", "MALFORMED", "ML-ASSISTED"],
            image: "./assets/showcase/mutation-campaign.svg",
            imageAlt: "ML4Fz mutation campaign example",
            imageLabel: "VIEW / MUTATION CAMPAIGN",
            address: "0x1400012F0"
        },
        {
            kicker: "FAILURE ANALYSIS",
            title: "Crash Triage",
            description:
                "Surface exceptions, suspicious responses and crash context so failures can be inspected without losing execution state.",
            tags: ["EXCEPTION", "STACK", "CRASH CONTEXT"],
            image: "./assets/showcase/crash-triage.svg",
            imageAlt: "ML4Fz crash triage example",
            imageLabel: "VIEW / CRASH TRIAGE",
            address: "0x1400013A0"
        },
        {
            kicker: "ADAPTIVE LOOP",
            title: "Feedback Refinement",
            description:
                "Feed useful runtime signals back into mutation and continuously refine the next fuzzing cycle.",
            tags: ["COVERAGE", "BEHAVIOR", "FEEDBACK"],
            image: "./assets/showcase/feedback-refinement.svg",
            imageAlt: "ML4Fz feedback refinement example",
            imageLabel: "VIEW / FEEDBACK REFINEMENT",
            address: "0x140001380"
        }
    ];

    const copy = showcase.querySelector(".showcase-copy");
    const frame = showcase.querySelector("[data-showcase-frame]");
    const image = showcase.querySelector("[data-showcase-image]");
    const index = showcase.querySelector("[data-showcase-index]");
    const kicker = showcase.querySelector("[data-showcase-kicker]");
    const title = showcase.querySelector("[data-showcase-title]");
    const description = showcase.querySelector("[data-showcase-description]");
    const tags = showcase.querySelector("[data-showcase-tags]");
    const imageLabel = showcase.querySelector("[data-showcase-image-label]");
    const imageAddress = showcase.querySelector("[data-showcase-image-address]");
    const dots = [...showcase.querySelectorAll("[data-showcase-dot]")];
    const previous = showcase.querySelector("[data-showcase-prev]");
    const next = showcase.querySelector("[data-showcase-next]");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const intervalDuration = 4500;
    let activeIndex = 0;
    let timer = null;

    const restartProgress = () => {
        showcase.classList.remove("is-playing");

        void showcase.offsetWidth;

        if (!prefersReducedMotion.matches) {
            showcase.classList.add("is-playing");
        }
    };

    const renderSlide = (nextIndex, animate = true) => {
        const normalizedIndex = (
            nextIndex + slides.length
        ) % slides.length;
        const slide = slides[normalizedIndex];

        const applyContent = () => {
            activeIndex = normalizedIndex;

            index.textContent = String(activeIndex + 1).padStart(2, "0");
            kicker.textContent = slide.kicker;
            title.textContent = slide.title;
            description.textContent = slide.description;
            image.src = slide.image;
            image.alt = slide.imageAlt;
            imageLabel.textContent = slide.imageLabel;
            imageAddress.textContent = slide.address;

            tags.innerHTML = "";

            slide.tags.forEach((tagText) => {
                const tag = document.createElement("span");
                tag.textContent = tagText;
                tags.appendChild(tag);
            });

            dots.forEach((dot, dotIndex) => {
                dot.classList.toggle("is-active", dotIndex === activeIndex);
            });

            copy.classList.remove("is-changing");
            frame.classList.remove("is-changing");
            restartProgress();
        };

        if (!animate || prefersReducedMotion.matches) {
            applyContent();
            return;
        }

        copy.classList.add("is-changing");
        frame.classList.add("is-changing");

        window.setTimeout(applyContent, 260);
    };

    const scheduleNext = () => {
        if (timer) {
            window.clearInterval(timer);
        }

        timer = window.setInterval(() => {
            renderSlide(activeIndex + 1);
        }, intervalDuration);
    };

    const goToSlide = (nextIndex) => {
        renderSlide(nextIndex);
        scheduleNext();
    };

    previous.addEventListener("click", () => {
        goToSlide(activeIndex - 1);
    });

    next.addEventListener("click", () => {
        goToSlide(activeIndex + 1);
    });

    dots.forEach((dot) => {
        dot.addEventListener("click", () => {
            goToSlide(Number(dot.dataset.showcaseDot));
        });
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            if (timer) {
                window.clearInterval(timer);
            }

            showcase.classList.remove("is-playing");
        } else {
            restartProgress();
            scheduleNext();
        }
    });

    prefersReducedMotion.addEventListener("change", () => {
        restartProgress();
    });

    renderSlide(0, false);
    restartProgress();
    scheduleNext();
}


const pageScrollProgress = document.querySelector("[data-page-scroll-progress]");
const scrollRevealSections = [...document.querySelectorAll("[data-scroll-reveal]")];
const scrollRevealChildren = [...document.querySelectorAll("[data-scroll-reveal-child]")];
const scrollStaggers = [...document.querySelectorAll("[data-scroll-stagger]")];
const heroBackground = document.querySelector(".hero-cfg-background");
const navLinks = [...document.querySelectorAll(".site-nav a[href^='#']")];
const scrollSections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const updateScrollProgress = () => {
    if (!pageScrollProgress) {
        return;
    }

    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0
        ? Math.min(1, Math.max(0, window.scrollY / scrollable))
        : 0;

    pageScrollProgress.style.transform = `scaleX(${progress})`;
};

const updateHeroParallax = () => {
    if (!heroBackground || reducedMotion.matches) {
        return;
    }

    const hero = document.querySelector(".hero");

    if (!hero) {
        return;
    }

    const rect = hero.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    if (rect.bottom < 0 || rect.top > viewportHeight) {
        return;
    }

    const progress = Math.max(
        -1,
        Math.min(1, (viewportHeight * 0.5 - rect.top) / viewportHeight)
    );
    const offset = progress * 18;

    heroBackground.style.setProperty("--hero-scroll-y", `${offset}px`);
};

const updateCurrentNavigation = () => {
    if (!scrollSections.length) {
        return;
    }

    const marker = window.innerHeight * 0.34;
    let currentSection = scrollSections[0];

    scrollSections.forEach((section) => {
        const rect = section.getBoundingClientRect();

        if (rect.top <= marker) {
            currentSection = section;
        }
    });

    navLinks.forEach((link) => {
        const target = link.getAttribute("href");
        link.classList.toggle(
            "is-current",
            currentSection && target === `#${currentSection.id}`
        );
    });
};

const handleScrollFrame = () => {
    updateScrollProgress();
    updateHeroParallax();
    updateCurrentNavigation();
};

let scrollFrame = null;

window.addEventListener(
    "scroll",
    () => {
        if (scrollFrame) {
            return;
        }

        scrollFrame = window.requestAnimationFrame(() => {
            handleScrollFrame();
            scrollFrame = null;
        });
    },
    { passive: true }
);

const revealObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
        });
    },
    {
        threshold: 0.16,
        rootMargin: "0px 0px -8% 0px"
    }
);

scrollRevealSections.forEach((section) => {
    revealObserver.observe(section);
});

scrollRevealChildren.forEach((element) => {
    revealObserver.observe(element);
});

scrollStaggers.forEach((element) => {
    revealObserver.observe(element);
});

if (reducedMotion.matches) {
    scrollRevealSections.forEach((section) => {
        section.classList.add("is-visible");
    });

    scrollRevealChildren.forEach((element) => {
        element.classList.add("is-visible");
    });

    scrollStaggers.forEach((element) => {
        element.classList.add("is-visible");
    });
}

handleScrollFrame();
